import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { normalize, join } from 'node:path';


const DATA_FILE = normalize(join(__dirname, 'processedChallenges.json'));
const USERS = normalize(join(__dirname, 'users.json'));

function getProcessedChallenges(id) {
  let processedChallenges = new Map();
  if (existsSync(DATA_FILE)) {
    const data = readFileSync(DATA_FILE, 'utf8');
    processedChallenges = new Map(JSON.parse(data));
  }
  return processedChallenges.get(id);
}

function setProcessedChallenges(id, challenge) {
  let processedChallenges = new Map();
  if (existsSync(DATA_FILE)) {
    const data = readFileSync(DATA_FILE, 'utf8');
    processedChallenges = new Map(JSON.parse(data));
  }
  processedChallenges.set(id, challenge);
  const data = JSON.stringify(Array.from(processedChallenges.entries()), null, 2);
  writeFileSync(DATA_FILE, data);
}

function getUsers() {
  let users = {};
  if (existsSync(USERS)) {
    const data = readFileSync(USERS, 'utf8');
    users = JSON.parse(data);
  }
  return users;
}

function setUsers(user, data) {
  let users = {};
  if(existsSync(USERS)){
    const userData = readFileSync(USERS, 'utf-8');
    users = JSON.parse(userData)
  }
  users[user] = {
    ...users[user], ...data
  }
  const userData = JSON.stringify(users, null, 2);
  writeFileSync(USERS, userData);
}

function checkUserExists(user) {
  let users = {};
  if (existsSync(USERS)) {
    const data = readFileSync(USERS, 'utf8');
    users = JSON.parse(data);
  }
  return users[user] && users[user].verified && users[user].signingid;
}

function checksigningid(user){
  let users = getUsers();
  if (existsSync(USERS)) {
    const data = readFileSync(USERS, 'utf8');
    users = JSON.parse(data);
  }
  return users[user] && users[user].signingId;
}

function updateUser(user, updateData){
  let users = getUsers();
  if(users[user]){
    users[user] = { ...users[user], ...updateData };
    const data = readFileSync(USERS, 'utf-8');
    const users = JSON.parse(data)
  }
}

function deleteUser(user) {
  let users = {};
  if (existsSync(USERS)) {
    const data = readFileSync(USERS, 'utf8');
    users = JSON.parse(data);
  }
  delete users[user];
  const data = JSON.stringify(users, null, 2);
  writeFileSync(USERS, data);
}

const _getProcessedChallenges = getProcessedChallenges;
export { _getProcessedChallenges as getProcessedChallenges };
const _setProcessedChallenges = setProcessedChallenges;
export { _setProcessedChallenges as setProcessedChallenges };
const _getUsers = getUsers;
export { _getUsers as getUsers };
const _setUsers = setUsers;
export { _setUsers as setUsers };
const _checkUserExists = checkUserExists;
export { _checkUserExists as checkUserExists };
const _deleteUser = deleteUser;
export { _deleteUser as deleteUser };
const _updateUser = updateUser;
export { _updateUser as updateUser };
const _checksigningid = checksigningid;
export { _checksigningid as checksigningid };