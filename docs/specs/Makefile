PDFLATEX = latexmk -pdf

SPECSNUMS = 1 2 3 4 4_typed 2_stepper 4_estepper

SPECS = $(SPECSNUMS:%=python_%) python_styleguide

PDFSPECS = $(SPECS:%=%.pdf)

HELPERS = typing_front typing_middle_12 typing_middle_34 typing_back typing_tail_12 typing_tail_34 1_bnf 3_bnf restrictions restrictions_common restrictions_3 4_typed_bnf static_typing

HELPERSTEX = $(HELPERS:%=python_%.tex)

all: $(PDFSPECS)

%.pdf: %.tex $(HELPERSTEX)
	$(PDFLATEX) $*

clean:
	rm -f *~ *.dvi *.aux *.log *.ps *.out *.pdf *.fdb_latexmk *.fls
