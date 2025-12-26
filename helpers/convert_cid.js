import { ethers } from "ethers";

function hexToCID(hex) {
  if (hex.startsWith("0x")) hex = hex.slice(2);
  const bytes = new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  
  const multihash = new Uint8Array(34);
  multihash[0] = 0x12;
  multihash[1] = 0x20;
  multihash.set(bytes, 2);
  
  return ethers.encodeBase58(multihash);
}

const gnosisRegistryHex = "0x7a43d5f52e969bdae849148994cfd3e17bd4f1637c6a2d2232e30d23b4312d84";
const gnosisMMHex = "0xb637c44d60372f7ad19f107ebf796746b9f9eb807a537fc58e1c45de809a00d4";

console.log(`Gnosis Registry CID: ${hexToCID(gnosisRegistryHex)}`);
console.log(`Gnosis MM CID: ${hexToCID(gnosisMMHex)}`);
