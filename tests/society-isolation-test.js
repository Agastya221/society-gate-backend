/**
 * Society Isolation Test Script
 * Verifies that users from Society A cannot access Society B's data
 *
 * Usage: node tests/society-isolation-test.js
 */

const axios = require('axios');

// Configuration - UPDATE THESE VALUES
const CONFIG = {
  apiBase: 'http://localhost:4000',

  // Society A credentials
  societyA: {
    adminToken: 'SOCIETY_A_ADMIN_TOKEN',
    residentToken: 'SOCIETY_A_RESIDENT_TOKEN',
    societyId: 'SOCIETY_A_ID',
  },

  // Society B credentials
  societyB: {
    adminToken: 'SOCIETY_B_ADMIN_TOKEN',
    residentToken: 'SOCIETY_B_RESIDENT_TOKEN',
    societyId: 'SOCIETY_B_ID',
    // Sample data IDs from Society B (for testing access)
    entryId: 'ENTRY_IN_SOCIETY_B',
    complaintId: 'COMPLAINT_IN_SOCIETY_B',
    gatePassId: 'GATEPASS_IN_SOCIETY_B',
    staffId: 'STAFF_IN_SOCIETY_B',
  },
};

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Test if Society A admin can access Society B's entries
 */
async function testEntryIsolation() {
  log('\n📋 TEST: Entry Isolation', 'cyan');

  const results = {
    listEntries: false,
    getSpecificEntry: false,
  };

  // Test 1: List entries
  try {
    log('   1. Society A admin listing entries...');
    const response = await axios.get(`${CONFIG.apiBase}/api/v1/entries`, {
      headers: { Authorization: `Bearer ${CONFIG.societyA.adminToken}` },
    });

    const entries = response.data.data?.entries || response.data.data || [];
    const societyBEntries = entries.filter(e => e.societyId === CONFIG.societyB.societyId);

    if (societyBEntries.length === 0) {
      log('      ✅ Cannot see Society B entries', 'green');
      results.listEntries = true;
    } else {
      log(`      ❌ Can see ${societyBEntries.length} Society B entries!`, 'red');
    }
  } catch (error) {
    log(`      ⚠️  Error: ${error.response?.status} - ${error.response?.data?.message || error.message}`, 'yellow');
  }

  // Test 2: Access specific entry from Society B
  try {
    log('   2. Society A admin accessing specific Society B entry...');
    const response = await axios.get(
      `${CONFIG.apiBase}/api/v1/entries/${CONFIG.societyB.entryId}`,
      {
        headers: { Authorization: `Bearer ${CONFIG.societyA.adminToken}` },
      }
    );

    log('      ❌ Successfully accessed Society B entry!', 'red');
  } catch (error) {
    if (error.response?.status === 403 || error.response?.status === 404) {
      log('      ✅ Access denied (403/404)', 'green');
      results.getSpecificEntry = true;
    } else {
      log(`      ⚠️  Unexpected error: ${error.response?.status}`, 'yellow');
    }
  }

  const passed = results.listEntries && results.getSpecificEntry;
  log(`\n   Overall: ${passed ? '✅ PASS' : '❌ FAIL'}`, passed ? 'green' : 'red');

  return passed;
}

/**
 * Test if Society A admin can access Society B's complaints
 */
async function testComplaintIsolation() {
  log('\n📋 TEST: Complaint Isolation', 'cyan');

  const results = {
    listComplaints: false,
    getSpecificComplaint: false,
  };

  // Test 1: List complaints
  try {
    log('   1. Society A admin listing complaints...');
    const response = await axios.get(`${CONFIG.apiBase}/api/v1/community/complaints`, {
      headers: { Authorization: `Bearer ${CONFIG.societyA.adminToken}` },
    });

    const complaints = response.data.data || [];
    const societyBComplaints = complaints.filter(c => c.societyId === CONFIG.societyB.societyId);

    if (societyBComplaints.length === 0) {
      log('      ✅ Cannot see Society B complaints', 'green');
      results.listComplaints = true;
    } else {
      log(`      ❌ Can see ${societyBComplaints.length} Society B complaints!`, 'red');
    }
  } catch (error) {
    log(`      ⚠️  Error: ${error.response?.status} - ${error.response?.data?.message || error.message}`, 'yellow');
  }

  // Test 2: Access specific complaint
  try {
    log('   2. Society A admin accessing specific Society B complaint...');
    const response = await axios.get(
      `${CONFIG.apiBase}/api/v1/community/complaints/${CONFIG.societyB.complaintId}`,
      {
        headers: { Authorization: `Bearer ${CONFIG.societyA.adminToken}` },
      }
    );

    log('      ❌ Successfully accessed Society B complaint!', 'red');
  } catch (error) {
    if (error.response?.status === 403 || error.response?.status === 404) {
      log('      ✅ Access denied (403/404)', 'green');
      results.getSpecificComplaint = true;
    } else {
      log(`      ⚠️  Unexpected error: ${error.response?.status}`, 'yellow');
    }
  }

  const passed = results.listComplaints && results.getSpecificComplaint;
  log(`\n   Overall: ${passed ? '✅ PASS' : '❌ FAIL'}`, passed ? 'green' : 'red');

  return passed;
}

/**
 * Test if Society A admin can access Society B's domestic staff
 */
async function testStaffIsolation() {
  log('\n📋 TEST: Domestic Staff Isolation', 'cyan');

  const results = {
    listStaff: false,
    getSpecificStaff: false,
  };

  // Test 1: List staff
  try {
    log('   1. Society A admin listing domestic staff...');
    const response = await axios.get(`${CONFIG.apiBase}/api/v1/staff/domestic`, {
      headers: { Authorization: `Bearer ${CONFIG.societyA.adminToken}` },
    });

    const staff = response.data.data?.staff || response.data.data || [];
    const societyBStaff = staff.filter(s => s.societyId === CONFIG.societyB.societyId);

    if (societyBStaff.length === 0) {
      log('      ✅ Cannot see Society B staff', 'green');
      results.listStaff = true;
    } else {
      log(`      ❌ Can see ${societyBStaff.length} Society B staff members!`, 'red');
    }
  } catch (error) {
    log(`      ⚠️  Error: ${error.response?.status} - ${error.response?.data?.message || error.message}`, 'yellow');
  }

  // Test 2: Access specific staff
  try {
    log('   2. Society A admin accessing specific Society B staff...');
    const response = await axios.get(
      `${CONFIG.apiBase}/api/v1/staff/domestic/${CONFIG.societyB.staffId}`,
      {
        headers: { Authorization: `Bearer ${CONFIG.societyA.adminToken}` },
      }
    );

    log('      ❌ Successfully accessed Society B staff!', 'red');
  } catch (error) {
    if (error.response?.status === 403 || error.response?.status === 404) {
      log('      ✅ Access denied (403/404)', 'green');
      results.getSpecificStaff = true;
    } else {
      log(`      ⚠️  Unexpected error: ${error.response?.status}`, 'yellow');
    }
  }

  const passed = results.listStaff && results.getSpecificStaff;
  log(`\n   Overall: ${passed ? '✅ PASS' : '❌ FAIL'}`, passed ? 'green' : 'red');

  return passed;
}

/**
 * Test if Society A admin can create data for Society B
 */
async function testCrossCreation() {
  log('\n📋 TEST: Cross-Society Creation Prevention', 'cyan');

  // Try to create domestic staff for Society B flat
  try {
    log('   1. Society A admin creating staff for Society B flat...');
    const response = await axios.post(
      `${CONFIG.apiBase}/api/v1/staff/domestic`,
      {
        name: 'Test Staff',
        staffType: 'MAID',
        phone: '+919999999999',
        societyId: CONFIG.societyB.societyId,
      },
      {
        headers: { Authorization: `Bearer ${CONFIG.societyA.adminToken}` },
      }
    );

    log('      ❌ Successfully created staff in Society B!', 'red');
    return false;
  } catch (error) {
    if (error.response?.status === 403 || error.response?.status === 400) {
      log('      ✅ Creation blocked (403/400)', 'green');
      return true;
    } else {
      log(`      ⚠️  Unexpected error: ${error.response?.status}`, 'yellow');
      return false;
    }
  }
}

/**
 * Main execution
 */
async function main() {
  log('\n🧪 Society Isolation Testing', 'cyan');
  log('================================\n');

  log('⚙️  Configuration:', 'yellow');
  log(`   API: ${CONFIG.apiBase}`);
  log(`   Society A ID: ${CONFIG.societyA.societyId}`);
  log(`   Society B ID: ${CONFIG.societyB.societyId}\n`);

  // Check if config is set
  if (CONFIG.societyA.adminToken === 'SOCIETY_A_ADMIN_TOKEN') {
    log('❌ ERROR: Please update the CONFIG object with your actual values!', 'red');
    log('   Edit tests/society-isolation-test.js and set:', 'yellow');
    log('   - societyA.adminToken, societyId');
    log('   - societyB.adminToken, societyId, sample data IDs\n');
    process.exit(1);
  }

  try {
    // Run all tests
    const test1 = await testEntryIsolation();
    const test2 = await testComplaintIsolation();
    const test3 = await testStaffIsolation();
    const test4 = await testCrossCreation();

    // Summary
    log('\n================================', 'cyan');
    log('🎉 Testing Complete!\n', 'cyan');

    log('📊 Summary:');
    log(`   Entry Isolation: ${test1 ? '✅ PASS' : '❌ FAIL'}`, test1 ? 'green' : 'red');
    log(`   Complaint Isolation: ${test2 ? '✅ PASS' : '❌ FAIL'}`, test2 ? 'green' : 'red');
    log(`   Staff Isolation: ${test3 ? '✅ PASS' : '❌ FAIL'}`, test3 ? 'green' : 'red');
    log(`   Cross-Creation Block: ${test4 ? '✅ PASS' : '❌ FAIL'}`, test4 ? 'green' : 'red');

    const allPassed = test1 && test2 && test3 && test4;

    if (allPassed) {
      log('\n✅ All society isolation tests passed!', 'green');
      log('   Your multi-tenancy is properly enforced.\n', 'green');
    } else {
      log('\n⚠️  Some tests failed!', 'yellow');
      log('   Please review ensureSameSociety middleware application.\n', 'yellow');
    }

    log('📝 Next Steps:');
    log('   1. If any tests failed, check ensureSameSociety middleware');
    log('   2. Test race conditions: node tests/race-condition-test.js');
    log('   3. Run full test suite: npm test\n');

  } catch (error) {
    log(`\n❌ Error running tests: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run tests
main();
