# Certificate trust fixtures

`compromised-cas.json` contains public certificate variants from the [eMudhra incident](https://github.com/galadran/we-have-a-problem.com), including the twelve blocked intermediate and ancestor keys and their cross-sign paths.

The registry CA, leaf and private key are test-only loopback fixtures. The two incident leaf chains use the same loopback key and exercise both compromised authentication paths; no intermediate private key is stored here. Tests require private-registry TLS to succeed and both incident chains to fail.

The Ed448 CA and localhost server chain are test-only fixtures for native OpenSSL/Git compatibility. The server uses the same test-only registry leaf key. Its CA signing key is not stored here. Native Ed448 HTTPS is exercised on Linux; other platforms retain the CA but use their native verifier's algorithm support.
