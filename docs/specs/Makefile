PDFLATEX = latexmk -pdf

SPECSNUMS = 1 2 3 4

SPECS = $(SPECSNUMS:%=python_%)

PDFSPECS = $(SPECS:%=%.pdf)

HELPERSTEX = $(HELPERS:%=python_%.tex)

all: $(PDFSPECS)

%.pdf: %.tex $(HELPERSTEX)
	$(PDFLATEX) $*

clean:
	rm -f *~ *.dvi *.aux *.log *.ps *.out *.pdf *.fdb_latexmk *.fls
