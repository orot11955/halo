# Deploy Examples

These files are examples for release and server install environments. Copy the
values into your shell, CI job, or deployment runner. Do not put real tokens or
secrets in this directory.

```sh
# build host
set -a
. deploy/release.env.example
set +a
./ctl release

# core host
set -a
. deploy/core.env.example
set +a
sudo -E ./ctl core:install

# node host
set -a
. deploy/node.env.example
set +a
sudo -E ./ctl node:install
```

Package archives already contain `ctl`, the matching binary artifacts, this
directory, and `docs/`.
