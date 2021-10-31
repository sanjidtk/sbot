const Client = require('instagram-private-api').V1;
const delay = require('delay');
const chalk = require('chalk');
const _ = require('lodash');
const rp = require('request-promise');
const S = require('string');
const inquirer = require('inquirer');

const User = [
{
  type:'input',
  name:'username',
  message:'[>] Insert Username:',
  validate: function(value){
    if(!value) return 'Can\'t Empty';
    return true;
  }
},
{
  type:'password',
  name:'password',
  message:'[>] Insert Password:',
  mask:'*',
  validate: function(value){
    if(!value) return 'Can\'t Empty';
    return true;
  }
},
{
  type:'input',
  name:'target',
  message:'[>] Insert Username Target (Without @[at]):',
  validate: function(value){
    if(!value) return 'Can\'t Empty';
    return true;
  }
},
{
  type:'input',
  name:'accountsPerDelay',
  message:'[>] Number of Accounts per Delay:',
  validate: function(value){
    value = value.match(/[0-9]/);
    if (value) return true;
    return 'Use Number Only!';
  }
},
{
  type:'input',
  name:'sleep',
  message:'[>] Insert Sleep (MiliSeconds):',
  validate: function(value){
    value = value.match(/[0-9]/);
    if (value) return true;
    return 'Delay is number';
  }
}
]

const Login = async function(User){

  const Device = new Client.Device(User.username);
  const Storage = new Client.CookieMemoryStorage();
  const session = new Client.Session(Device, Storage);

  try {
    await Client.Session.create(Device, Storage, User.username, User.password)
    const account = await session.getAccount();
    return Promise.resolve({session,account});
  } catch (err) {
    return Promise.reject(err);
  }

}

const Target = async function(username){
  const url = 'https://www.instagram.com/'+username+'/'
  const option = {
    url: url,
    method: 'GET'
  }
  try{
    const account = await rp(option);
    const data = S(account).between('<script type="text/javascript">window._sharedData = ', ';</script>').s
    const json = JSON.parse(data);
    if (json.entry_data.ProfilePage[0].graphql.user.is_private) {
      return Promise.reject('Target is private Account');
    } else {
      const id = json.entry_data.ProfilePage[0].graphql.user.id;
      const followers = json.entry_data.ProfilePage[0].graphql.user.edge_followed_by.count;
      return Promise.resolve({id,followers});
    }
  } catch (err){
    return Promise.reject(err);
  }

}

async function ngefollow(session,accountId){
  try {
    await Client.Relationship.create(session, accountId);
    return true
  } catch (e) {
    return false
  }
}

const Follow = async function(session, accountId){
    const task = [
    ngefollow(session, accountId),
    ]
    const [Follow] = await Promise.all(task);
    const printFollow = Follow ? chalk`{green Follow}` : chalk`{red Follow}`;
    return chalk`{bold.green ${printFollow}}`;
};

const Followers = async function(session, id){
  const feed = new Client.Feed.AccountFollowers(session, id);
  try{
    const Pollowers = [];
    var cursor;
    do {
      if (cursor) feed.setCursor(cursor);
      const getPollowers = await feed.get();
      await Promise.all(getPollowers.map(async(akun) => {
        Pollowers.push(akun.id);
      }))
      cursor = await feed.getCursor();
    } while(feed.isMoreAvailable());
    return Promise.resolve(Pollowers);
  } catch(err){
    return Promise.reject(err);
  }
}

const Excute = async function(User, TargetUsername, Sleep, accountsPerDelay){
  try {
    console.log(chalk`{yellow \n [?] Try to Login . . .}`)
    const doLogin = await Login(User);
    console.log(chalk`{green  [!] Login Succsess, }{yellow [?] Try To Get ID & Followers Target . . .}`)
    const getTarget = await Target(TargetUsername);
    console.log(chalk`{green  [!] ${TargetUsername}: [${getTarget.id}] | Followers: [${getTarget.followers}]}`)
    const getFollowers = await Followers(doLogin.session, doLogin.account.id)
    console.log(chalk`{cyan  [?] Try to Follow Followers Target . . . \n}`)
    const Targetfeed = await new Client.Feed.AccountFollowers(doLogin.session, getTarget.id);
    var TargetCursor;
    do {
      if (TargetCursor) Targetfeed.setCursor(TargetCursor);
      var TargetResult = await Targetfeed.get();
      TargetResult = _.chunk(TargetResult, accountsPerDelay);
      for (let i = 0; i < TargetResult.length; i++) {
        var timeNow = new Date();
        timeNow = `${timeNow.getHours()}:${timeNow.getMinutes()}:${timeNow.getSeconds()}`
        await Promise.all(TargetResult[i].map(async(akun) => {
          if (!getFollowers.includes(akun.id) && akun.params.isPrivate === false) {
            const ngeDo = await Follow(doLogin.session, akun.id)
            console.log(chalk`[{magenta ${timeNow}}] {bold.cyan [>]}${akun.params.username} => ${ngeDo}`)
          }
        }));
        console.log(chalk`{yellow \n [#][>][{cyan Account: ${User.username}}][{cyan Target: @${TargetUsername}}] Delay For ${Sleep} MiliSeconds [<][#] \n}`)
        await delay(Sleep);
      }
      TargetCursor = await Targetfeed.getCursor();
    } while(Targetfeed.isMoreAvailable());
  } catch (err) {
    console.log(err);
  }
}

console.log(chalk`
  {bold.cyan
  —————————————————— [INFORMATION] ————————————————————

  [?] {bold.green FFTPeople | Just Follow!}

  ——————————————————  [THANKS TO]  ————————————————————
  [✓] CODE BY CYBER SCREAMER CCOCOT (ccocot@bc0de.net)
  [✓] FIXING & TESTING BY SYNTAX (@officialputu_id)
  [✓] MODIFIED BY @mohsanjid X PhotoLooz
  —————————————————————————————————————————————————————}
      `);

inquirer.prompt(User)
.then(answers => {
  Excute({
    username:answers.username,
    password:answers.password
  },answers.target,answers.sleep,answers.accountsPerDelay);
})
