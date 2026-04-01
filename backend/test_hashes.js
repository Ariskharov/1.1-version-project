const bcrypt = require('bcryptjs');

const arifHash = '$2b$10$gbzBnxQlec0ehjg8I6cVn.0PRZyV2SA8fYybiEvcVgA0X4vo4/6je';
const emirHash = '$2b$10$pILmFqJzJSyHgXzMBxbm/O0r29DRD1whCM9rdfnZLXfaeFoDLHOO.';

const arifMatch = bcrypt.compareSync('0000', arifHash);
const emirMatch = bcrypt.compareSync('1234', emirHash);

console.log('Arif match:', arifMatch);
console.log('Emir match:', emirMatch);
