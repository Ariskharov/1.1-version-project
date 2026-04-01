const bcrypt = require('bcryptjs');

try {
    const isMatch = bcrypt.compareSync('1234', '1234');
    console.log('compareSync with plain text returned:', isMatch);
} catch (e) {
    console.error('compareSync threw error:', e.message);
}

try {
    const isMatch2 = bcrypt.compareSync('1234', '$2a$10$abcdefghijklmnopqrstuv');
    console.log('compareSync with bad hash returned:', isMatch2);
} catch (e) {
    console.error('compareSync threw error on bad hash:', e.message);
}
