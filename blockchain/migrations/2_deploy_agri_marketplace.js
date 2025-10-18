const AgriMarketplace = artifacts.require("AgriMarketplace");

export default function (deployer) {
	deployer.deploy(AgriMarketplace);
}
