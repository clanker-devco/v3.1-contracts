# CLANK FROM DOCS

welcome to the example js/ts code! 

the first step here is you'll want to make a .env out of the example.env

after that, check out the `DeployToken.ts` and `deploy-cli.ts` files to get a gist of what's going on to build a clanker

when you're ready, run a command like this: `npm run deploy-token -- --name "My Awesome Token" --symbol "MAT" --description "This is my awesome token" --devBuyAmount "0" --creatorReward 30`

pair with another token like NATIVE: `npm run deploy-token -- --name "My Awesome Token" --symbol "MAT" --description "This is my awesome token" --devBuyAmount "0" --creatorReward 30 --pair "HIGHER"`

clank clank