#!/bin/bash

cd $( dirname "$0" )
npm run build
rm -f data/*.{rrd,png}
time node build/index.js

