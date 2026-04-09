import { ExprNS, StmtNS } from "../ast-types";
import type { AnalysisModule, HintTable } from "./analysis-module";
import type { SlotLookup } from "./types";

/**
 * Generic per-function type environment: maps slot index → L.
 *
 * Slot indices are assigned by SVMLCompiler.getOrAssignSlot — the same numbering
 * used here ensures analysis and codegen agree on which variable is which.
 *
 * Reference equality is the fast path for AbstractValue comparisons because
 * lattice-ops.ts returns frozen singletons. Identical lattice values are always
 * the same object. The leq-based path handles non-singleton join results.
 */
export class MutableEnv<L> {
  private slots: (L | undefined)[];

  constructor(initial: (L | undefined)[] = []) {
    this.slots = initial.slice();
  }

  get(slot: number): L | undefined {
    return this.slots[slot];
  }

  set(slot: number, val: L): void {
    this.slots[slot] = val;
  }

  snapshot(): MutableEnv<L> {
    return new MutableEnv(this.slots);
  }

  /**
   * In-place join: for each slot, replace with join(this[i], other[i]).
   * Used at merge points (if/else branches, loop header widening).
   */
  joinWith(other: MutableEnv<L>, joinFn: (a: L, b: L) => L): void {
    const len = Math.max(this.slots.length, other.slots.length);
    for (let i = 0; i < len; i++) {
      const a = this.slots[i];
      const b = other.slots[i];
      if (a !== undefined && b !== undefined) {
        this.slots[i] = joinFn(a, b);
      } else {
        this.slots[i] = a ?? b;
      }
    }
  }

  /**
   * Lattice equality: a == b iff leq(a,b) && leq(b,a).
   * Reference equality is used as a fast path since singletons are interned.
   */
  equals(other: MutableEnv<L>, leq: (a: L, b: L) => boolean): boolean {
    if (this.slots.length !== other.slots.length) return false;
    for (let i = 0; i < this.slots.length; i++) {
      const a = this.slots[i];
      const b = other.slots[i];
      if (a === b) continue; // fast path: same singleton reference
      if (a === undefined || b === undefined) return false;
      if (!leq(a, b) || !leq(b, a)) return false;
    }
    return true;
  }

  toArray(): (L | undefined)[] {
    return this.slots.slice();
  }
}

/**
 * DFA statement driver: implements StmtNS.Visitor<void>.
 *
 * Manages the type environment across control flow constructs and delegates
 * expression annotation to the visitor produced by module.makeExprVisitor().
 * The while-loop fixpoint replaces the legacy 2-pass widening hack with proper
 * convergence iteration.
 *
 * @typeParam L - The lattice element type for this analysis.
 */
class DFAStatementDriver<L> implements StmtNS.Visitor<void> {
  constructor(
    private typeEnv: MutableEnv<L>,
    private readonly hints: HintTable,
    private readonly slotLookup: SlotLookup,
    private readonly module: AnalysisModule<L>,
  ) {}

  private visitExpr(expr: ExprNS.Expr): L {
    // Fresh visitor snapshot: captures current typeEnv state at call time.
    // Creating a new visitor per call avoids stale-env bugs when typeEnv
    // is mutated between visits (e.g., inside loop body).
    const visitor = this.module.makeExprVisitor(
      this.hints,
      this.typeEnv.toArray(),
      this.slotLookup,
    );
    return expr.accept(visitor);
  }

  private visitBlock(stmts: StmtNS.Stmt[]): void {
    for (const stmt of stmts) {
      stmt.accept(this);
    }
  }

  visitAssignStmt(stmt: StmtNS.Assign): void {
    const val = this.visitExpr(stmt.value);
    if (!(stmt.target instanceof ExprNS.Variable)) return; // subscript targets unsupported
    const info = this.slotLookup(stmt.target.name);
    if (!info.isPrimitive && info.envLevel === 0) {
      this.typeEnv.set(info.slot, val);
    }
  }

  visitAnnAssignStmt(stmt: StmtNS.AnnAssign): void {
    const val = this.visitExpr(stmt.value);
    const info = this.slotLookup(stmt.target.name);
    if (!info.isPrimitive && info.envLevel === 0) {
      this.typeEnv.set(info.slot, val);
    }
  }

  visitIfStmt(stmt: StmtNS.If): void {
    this.visitExpr(stmt.condition);

    const saved = this.typeEnv.snapshot();

    this.visitBlock(stmt.body);
    const afterTrue = this.typeEnv.snapshot();

    // Restore to pre-if env, then visit else branch
    this.typeEnv = saved;
    if (stmt.elseBlock) {
      this.visitBlock(stmt.elseBlock);
    }
    // afterFalse is now this.typeEnv

    // Join both branches: the post-if env is the join of true and false branches
    afterTrue.joinWith(this.typeEnv, this.module.join.bind(this.module));
    this.typeEnv = afterTrue;
  }

  visitWhileStmt(stmt: StmtNS.While): void {
    // Proper fixpoint iteration replacing the 2-pass widening hack.
    //
    // Algorithm: repeat { save stable env; run body; compute widened = join(stable, post) }
    // until widened == stable (join added no new info).
    //
    // Correctness: `widened.equals(stableEnv)` checks join(pre, post) == pre, which
    // holds iff post <= pre (i.e., the body's output is already contained in the header env).
    // Terminates because join is monotone and the lattice has finite height.
    for (;;) {
      const stableEnv = this.typeEnv.snapshot(); // save entry env before body

      this.visitExpr(stmt.condition);
      this.visitBlock(stmt.body);
      // this.typeEnv is now the post-body env

      // Compute widened = join(entry, post-body)
      const widened = stableEnv.snapshot();
      widened.joinWith(this.typeEnv, this.module.join.bind(this.module));

      // Fixpoint: did the join add any new info over the entry env?
      if (widened.equals(stableEnv, this.module.leq.bind(this.module))) {
        // Use the fixpoint env as the post-loop env: it covers 0..n iterations,
        // so it includes the pre-loop values (loop-never-ran case). post-body does not.
        this.typeEnv = widened;
        break;
      }

      // Not yet stable: widen entry env and retry
      this.typeEnv = widened;
    }
  }

  visitForStmt(stmt: StmtNS.For): void {
    const preLoopEnv = this.typeEnv.snapshot();

    this.visitExpr(stmt.iter);

    // Loop variable could be anything from the iterator — conservatively use TOP
    const info = this.slotLookup(stmt.target);
    if (!info.isPrimitive && info.envLevel === 0) {
      this.typeEnv.set(info.slot, this.module.top());
    }

    this.visitBlock(stmt.body);

    // Join pre-loop env with post-body: the loop may not execute at all.
    // The body converges in one pass (loop target is always TOP), so no fixpoint
    // iteration is needed — but the exit join is required for soundness.
    preLoopEnv.joinWith(this.typeEnv, this.module.join.bind(this.module));
    this.typeEnv = preLoopEnv;
  }

  visitFunctionDefStmt(_stmt: StmtNS.FunctionDef): void {
    // Skip: function bodies are not analyzed here; parameters receive TOP.
    // Callers should invoke runAnalysisPass per function body if inter-procedural
    // analysis is desired.
  }

  visitReturnStmt(stmt: StmtNS.Return): void {
    if (stmt.value) this.visitExpr(stmt.value);
  }

  visitSimpleExprStmt(stmt: StmtNS.SimpleExpr): void {
    this.visitExpr(stmt.expression);
  }

  visitFileInputStmt(stmt: StmtNS.FileInput): void {
    this.visitBlock(stmt.statements);
  }

  visitAssertStmt(stmt: StmtNS.Assert): void {
    this.visitExpr(stmt.value);
  }

  // Statements with no type effects
  visitPassStmt(_stmt: StmtNS.Pass): void {}
  visitBreakStmt(_stmt: StmtNS.Break): void {}
  visitContinueStmt(_stmt: StmtNS.Continue): void {}
  visitGlobalStmt(_stmt: StmtNS.Global): void {}
  visitNonLocalStmt(_stmt: StmtNS.NonLocal): void {}
  visitFromImportStmt(_stmt: StmtNS.FromImport): void {}
}

/**
 * Run one forward type analysis pass over a list of statements.
 *
 * The while-loop fixpoint is handled internally by DFAStatementDriver; a single
 * call produces stable output for an entire function body.
 *
 * @param stmts    - Statements to analyse (top-level or function body)
 * @param module   - AnalysisModule providing lattice ops and expression visitor
 * @param env      - Initial type environment (mutated in-place)
 * @param hints    - HintTable to annotate expression nodes (mutated in-place)
 * @param slotLookup - Maps tokens to slot/envLevel/isPrimitive
 */
export function runAnalysisPass<L>(
  stmts: StmtNS.Stmt[],
  module: AnalysisModule<L>,
  env: MutableEnv<L>,
  hints: HintTable,
  slotLookup: SlotLookup,
): void {
  const driver = new DFAStatementDriver<L>(env, hints, slotLookup, module);
  for (const stmt of stmts) {
    stmt.accept(driver);
  }
}
