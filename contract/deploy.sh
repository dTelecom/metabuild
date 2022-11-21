#!/bin/sh

. ../.env

echo ">> Deploying contract"

near deploy --wasmFile ./target/wasm32-unknown-unknown/release/contract.wasm --accountId $CONTRACT_NAME
near call $CONTRACT_NAME init "{\"owner\": \"$ACCOUNT_ID\"}" --accountId $CONTRACT_NAME