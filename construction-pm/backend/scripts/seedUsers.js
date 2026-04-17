require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/db');

async function seed() {
    console.log('🌱 Seeding users...');

    // Admin user
    const adminHash = await bcrypt.hash('navyakar@2026', 10);
    await db.query(`
    INSERT IGNORE INTO users (username, password_hash, role, display_name)
    VALUES (?, ?, 'admin', 'Admin')
  `, ['admin', adminHash]);
    console.log('✅ Admin created → username: admin | password: navyakar@2026');

    // Dhaval user
    const dhavalHash = await bcrypt.hash('dhaval@2026', 10);
    await db.query(`
    INSERT IGNORE INTO users (username, password_hash, role, display_name)
    VALUES (?, ?, 'user', 'Dhaval Mevada')
  `, ['dhaval', dhavalHash]);
    console.log('✅ Dhaval created → username: dhaval | password: dhaval@2026');

    // Assign all existing clients to dhaval
    const [
        [dhaval]
    ] = await db.query(`SELECT id FROM users WHERE username = 'dhaval'`);
    await db.query(`UPDATE clients SET user_id = ? WHERE user_id IS NULL`, [dhaval.id]);
    console.log(`✅ All existing clients assigned to dhaval (user_id=${dhaval.id})`);

    console.log('\n🎉 Done! You can now login.');
    process.exit(0);
}

seed().catch(e => { console.error('❌ Seed failed:', e.message);
    process.exit(1); });