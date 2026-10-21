// Remove the twelve compromised eMudhra/intermediate trust-path keys from a PEM bundle.
const { X509Certificate, createHash } = require("node:crypto");
const { readFileSync, writeFileSync, mkdirSync } = require("node:fs");
const path = require("node:path");
const blocked = new Set([
	"0a6c2b2ca5b364207954171987ac9d2178561569d8205457e77ca90c32ede282",
	"43bffa19d6ef651451f6841e019931e96f6f2eaeff28ab4b6f1ce4576de2717b",
	"49dd353dc2b919a3770645117d0e60c16115e7d1bc259eefe734b00ea434fe5f",
	"5c0660a2b164910d8ff589c18e14552e9e0ec237dcefe2cb736d41a4811f81a0",
	"63ecefee431d49523bc1136c4e72d0206a477086caf606cd5cf025686c109cf8",
	"8d417db2dd8bf5e3084d1e3f196d583849d81bdd4c00c70b9d39369e96b8c782",
	"92c063d67e8f14db71d288e11266ffdaf69cbf115f7bab14f3bc2f68d25e0e30",
	"bd153ed7b0434f6886b17bce8bbe84ed340c7132d702a8f4fa318f756ecbd6f3",
	"c619e4780ed8e0abeda24ad732567de4383a7ea941338f6d1a7d1b49ac792fe9",
	"e0254c7fcdc265e2f0f8a428dabb75ab4ae039b4872d62f5ee57f0877d5a8a41",
	"ebed6475c2c2d80fcb199f3fe8dd6e6b3ce60b77eb15d4e42c3dec0c6f5b5105",
	"ec4ffa1ad0ac88081314b7aaffef6a91f97cd57291bb5ba686c5415f5eb4f6b6",
]);
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("Usage: filter-trusted-cas.cjs <input.pem> <output-directory>");
const certificates =
	readFileSync(input, "utf8").match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [];
const retained = certificates.filter((pem) => {
	const certificate = new X509Certificate(pem);
	const key = createHash("sha256")
		.update(certificate.publicKey.export({ type: "spki", format: "der" }))
		.digest("hex");
	return !blocked.has(key);
});
if (!retained.length) throw new Error("Refusing an empty TLS trust bundle");
mkdirSync(path.join(output, "empty"), { recursive: true });
writeFileSync(path.join(output, "ca-bundle.crt"), `${retained.join("\n")}\n`);
console.log(
	`Prepared ${retained.length} trusted CAs; removed ${certificates.length - retained.length} incident certificates`,
);
