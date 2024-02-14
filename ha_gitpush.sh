#!/bin/sh

# Go to /config folder or 
cd /config
git add .
git commit -m "configs backup: `date +'%d-%m-%Y %H:%M:%S'`"
git push -u origin master
