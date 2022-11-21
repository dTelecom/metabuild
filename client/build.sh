#!/bin/bash

rm main;
mkdir gopath;

PROJECT=$(pwd);
export GOPATH=$PROJECT"/gopath";

GOLINT="../gopath/bin/golint";

cd src;

if [ ! -f "$GOLINT" ]; then
  go install golang.org/x/lint/golint@latest
fi;

export GOPATH=$PROJECT":"$PROJECT"/gopath:";

gofmt -s -w . && $GOLINT ./... && go vet && go build;
mv main ../;
cd ../;
