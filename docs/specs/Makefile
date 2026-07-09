PDFLATEX = latexmk -pdf

SPECSNUMS = 1 2 3 4

SPECS = $(SPECSNUMS:%=python_%)

PDFSPECS = $(SPECS:%=%.pdf)

HELPERS = typing_front typing_middle_12 typing_middle_34 typing_back typing_tail_12 typing_tail_34

HELPERSTEX = $(HELPERS:%=python_%.tex)

all: $(PDFSPECS)

%.pdf: %.tex $(HELPERSTEX)
	$(PDFLATEX) $*

clean:
	rm -f *~ *.dvi *.aux *.log *.ps *.out *.pdf *.fdb_latexmk *.fls
