#!/usr/bin/env python

import sys
import os
import argparse
import subprocess

def go(cfg):
    with open("%s.manifest" % cfg.dataset) as mf:
        chunks = [line.strip() for line in mf.readlines()]
    chunks = chunks[cfg.start:]

    if cfg.count > 0:
        chunks = chunks[:cfg.count]

    try:
        os.mkdir(cfg.dataset, 0755)
    except OSError as e:
        print e.strerror
    
    index = cfg.start
    while len(chunks) > 0:
        batch = chunks[:cfg.batch]
        fetch(cfg, batch, index)
        chunks = chunks[cfg.batch:]
        index += len(batch)

def fetch(cfg, batch, index):
    wget(cfg, batch, index)

def wget(cfg, batch, index):
    print "Fetching batch %d" % index
    urls = [cfg.url + chunk for chunk in batch]
    p = subprocess.Popen(["wget", "-P", cfg.dataset] + urls)
    rc = p.wait()
    if rc != 0:
        raise Exception("Error fetching data: wget exit code %d" % rc)

    
def main(args):
    parser = argparse.ArgumentParser(
        prog = "dataset-fetch.py",
        description = "fetch (part of) a dataset and prepare it for ingestion")

    parser.add_argument('-b', '--batch',
                        type = int,
                        default = 100,
                        dest = 'batch',
                        help = "Number of chunks on each worker batch")
    parser.add_argument('-c', '--count',
                        type = int,
                        default = 0,
                        dest = 'count',
                        help = "How many chunks to fetch; 0 will fetch the entire dataset")
    parser.add_argument('-s', '--start',
                        type = int,
                        default = 0,
                        dest = 'start',
                        help = "Start index in the manifest")
    parser.add_argument('dataset',
                        type = str,
                        help = "Name of the dataset")
    parser.add_argument('url',
                        type = str,
                        help = "Base URL for dataset chunks")
    cfg = parser.parse_args(args)
    go(cfg)

if __name__ == '__main__':
    main(sys.argv[1:])
