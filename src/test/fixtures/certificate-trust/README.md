# Certificate trust fixtures

`compromised-cas.json` contains public certificate variants from the [eMudhra incident](https://github.com/galadran/we-have-a-problem.com), including the twelve blocked intermediate and ancestor keys and their cross-sign paths.

The registry CA, leaf and private key are test-only loopback fixtures. The two incident leaf chains use the same loopback key and exercise both compromised authentication paths; no intermediate private key is stored here. Tests require private-registry TLS to succeed and both incident chains to fail.

The trusted and rejected registry CA fixtures use OpenSSL's `TRUSTED CERTIFICATE` PEM format with auxiliary `serverAuth` trust and reject policies. They were generated with `openssl x509 -trustout -addtrust serverAuth` and `-addreject serverAuth`. The Nix updater accepts both PEM forms as explicit build inputs. Runtime Git fetches retain the user's native trust policy; the private registry certificate also exercises a configured HTTPS proxy.
