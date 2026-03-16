PDFLATEX = latexmk -pdf

SPECSNUMS = 1 2 3

SPECS = $(SPECSNUMS:%=python_%)

PDFSPECS = $(SPECS:%=%.pdf)

HELPERSTEX = $(HELPERS:%=python_%.tex)

all: $(PDFSPECS)

%.pdf: %.tex 
	$(PDFLATEX) $*

clean:
	rm -f *~ *.dvi *.aux *.log *.ps *.out *.pdf *.fdb_latexmk *.fls
