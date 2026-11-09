PDFLATEX = latexmk -pdf

SPECSNUMS = 1 2 3 4 4_typed 2_stepper 4_estepper

SPECS = $(SPECSNUMS:%=python_%) python_styleguide

PDFSPECS = $(SPECS:%=%.pdf)

HELPERS = typing_front typing_middle_12 typing_middle_34 typing_back typing_tail_12 typing_tail_34 1_bnf 3_bnf restrictions restrictions_common restrictions_3 4_typed_bnf static_typing

HELPERSTEX = $(HELPERS:%=python_%.tex)

# The typed parts of the specification of Python §4 Typed, generated from the type checker's declarations
GENERATED = generated/linked_list_typed.py generated/stream_typed.py generated/python_typed_names.tex

all: $(PDFSPECS)

$(GENERATED): ../../scripts/typed-spec.ts ../../scripts/typed-readme.ts ../../src/typecheck/prelude.pyi \
		../lib/linked_list.py ../lib/stream.py ../lib/helper-types.txt
	cd ../.. && yarn tsx scripts/typed-spec.ts

python_4_typed.pdf: $(GENERATED)

%.pdf: %.tex $(HELPERSTEX)
	$(PDFLATEX) $*

clean:
	rm -rf *~ *.dvi *.aux *.log *.ps *.out *.pdf *.fdb_latexmk *.fls generated
