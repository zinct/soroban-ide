/**
 * Backend Connectivity & Smoke Test
 * 
 * Usage:
 *   node tests/backend-check.js http://YOUR_BACKEND_IP:8080
 */

const BACKEND_URL = process.argv[2] || 'http://localhost:8080';

console.log(`\n🔍 Checking backend at: ${BACKEND_URL}`);
console.log('-------------------------------------------');

async function checkHealth() {
    try {
        console.log('1. Testing /health endpoint...');
        const res = await fetch(`${BACKEND_URL}/health`);
        const data = await res.json();
        
        if (res.ok && data.status === 'ok') {
            console.log('✅ HEALTH OK:', JSON.stringify(data));
            return true;
        } else {
            console.log('❌ HEALTH FAILED:', res.status, data);
            return false;
        }
    } catch (err) {
        console.log('❌ CONNECTION FAILED:', err.message);
        return false;
    }
}

async function smokeTestRun() {
    try {
        console.log('\n2. Testing /run endpoint (Smoke Test)...');
        const res = await fetch(`${BACKEND_URL}/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                command: 'stellar --version',
                files: {} // No files needed for version check
            })
        });
        
        const data = await res.json();
        
        if (res.status === 202 || res.status === 200) {
            console.log('✅ RUN ACCEPTED: Session ID =', data.session_id);
            console.log('   (This means the backend queue and worker are responsive)');
            return true;
        } else {
            console.log('❌ RUN FAILED:', res.status, data);
            return false;
        }
    } catch (err) {
        console.log('❌ SMOKE TEST FAILED:', err.message);
        return false;
    }
}

async function main() {
    const healthOk = await checkHealth();
    if (!healthOk) {
        console.log('\n🛑 Aborting smoke test because health check failed.');
        process.exit(1);
    }
    
    const runOk = await smokeTestRun();
    
    console.log('\n-------------------------------------------');
    if (runOk) {
        console.log('🎉 ALL SYSTEMS GO! Your backend is ready for use.');
    } else {
        console.log('⚠️ Backend is reachable, but execution (docker/stellar) might have issues.');
        process.exit(1);
    }
}

main();
