import csv
import json
from collections import defaultdict, OrderedDict

copies = defaultdict(OrderedDict)

def add_copy(lang, id, text):
    copy = copies[lang]
    copy[id] = text

with open('copy.csv') as csvfile:
    reader = csv.reader(csvfile)
    colnames = []
    langs = []

    def getcol(row, name):
        return row[colnames.index(name)]
    for idx, row in enumerate(reader):
        if idx == 0:
            colnames = [c.lower() for c in row]
            langs = [c for c in colnames if c and c != 'id']
        else:
            id = getcol(row, 'id')
            if not id:
                continue

            for lang in langs:
                text = getcol(row, lang)
                if not text:
                    text = getcol(row, 'en')
                add_copy(lang, id, text)

for lang, copy in copies.items():
    outpath = 'static/data/copies/copies.%s.json' % lang
    with open(outpath, 'w') as f:
        json.dump(copy, f, indent=4)
        print 'wrote:', outpath
