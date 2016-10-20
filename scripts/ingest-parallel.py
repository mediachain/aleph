#!/usr/bin/env python

import sys
import os
import subprocess
import time
import argparse
import tempfile
import shutil
import glob
import multiprocessing

def ingest(ns):
    procs = dict()

    def spawn(afile):
        print "Ingest %s" % afile
        proc = subprocess.Popen([ns.script, afile])
        procs[proc.pid] = proc

    def reap_some():
        done = []
        while True:
            for (pid, proc) in procs.items():
                if proc.poll() is not None:
                    done.append(pid)

            if len(done) > 0:
                for pid in done:
                    del procs[pid]
                break
            else:
                time.sleep(1)

    for afile in glob.glob('{}/*'.format(ns.dir)):
        if (len(procs) < ns.procs):
            spawn(afile)
        else:
            reap_some()
            spawn(afile)

    while len(procs) > 0:
        reap_some()

def main(args):
    ncpus = multiprocessing.cpu_count()
    
    parser = argparse.ArgumentParser(
        prog = "ingest-parallel.py",
        description = "ingest a dir of ndjson files in parallel"
    )
    parser.add_argument('-n', '--processes',
                        type = int,
                        default = ncpus,
                        dest = 'procs',
                        help = "Number of parallel ingestion processes; defaults to number of cpus")
    parser.add_argument('script',
                        type = str,
                        help = "Ingest script; must accept ndjson filname")
    parser.add_argument('dir',
                        type = str,
                        help = "input dir of ndjson files")
    ns = parser.parse_args(args)
    ingest(ns)


if __name__ == '__main__':
    main(sys.argv[1:])
