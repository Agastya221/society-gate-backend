/**
 * Race Condition Test Script
 * Tests PreApproval and GatePass QR scanning under concurrent load
 *
 * Usage: node tests/race-condition-test.js
 */

const axios = require('axios');

// Configuration - UPDATE THESE VALUES
const CONFIG = {
  apiBase: 'http://localhost:4000',
  guardToken: 'YOUR_GUARD_TOKEN_HERE',

  // For PreApproval test
  preApproval: {
    qrToken: 'YOUR_PREAPPROVAL_QR_HERE',
    flatId: 'YOUR_FLAT_ID_HERE',
    societyId: 'YOUR_SOCIETY_ID_HERE',
    expectedMaxUses: 3, // The maxUses value you set when creating
  },

  // For GatePass test
  gatePass: {
    qrCode: 'YOUR_GATEPASS_QR_HERE',
    guardId: 'YOUR_GUARD_ID_HERE',
  },
};

// Colors for console output
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
 * Test 1: PreApproval QR Scan Race Condition
 */
async function testPreApprovalRaceCondition() {
  log('\n📋 TEST 1: PreApproval QR Scan Race Condition', 'cyan');
  log('   Objective: Only maxUses should succeed, rest should fail\n');

  const { qrToken, flatId, societyId, expectedMaxUses } = CONFIG.preApproval;
  const concurrentRequests = 10;

  log(`   Sending ${concurrentRequests} concurrent scan requests...`);

  const scanPreApproval = async () => {
    try {
      const response = await axios.post(
        `${CONFIG.apiBase}/api/preapprovals/scan`,
        {
          qrToken,
          flatId,
          societyId,
        },
        {
          headers: {
            'Authorization': `Bearer ${CONFIG.guardToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
      };
    }
  };

  // Execute concurrent requests
  const requests = Array(concurrentRequests).fill(null).map(() => scanPreApproval());
  const results = await Promise.all(requests);

  // Analyze results
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;
  const maxUsesErrors = results.filter(r =>
    r.message && r.message.toLowerCase().includes('maximum uses')
  ).length;

  log('   ✅ All requests completed\n');
  log('   📊 Results:');
  log(`      Successful scans: ${successCount}`);
  log(`      Failed scans: ${failureCount}`);
  log(`      'Max uses' errors: ${maxUsesErrors}`);

  // Detailed breakdown
  console.log('\n   📝 Detailed breakdown:');
  results.forEach((result, index) => {
    if (result.success) {
      console.log(`      Request ${index + 1}: ✅ SUCCESS - usedCount: ${result.data.data?.preApproval?.usedCount}`);
    } else {
      console.log(`      Request ${index + 1}: ❌ FAILED - ${result.message}`);
    }
  });

  // Validate
  console.log('');
  const passed = successCount <= expectedMaxUses && maxUsesErrors >= (concurrentRequests - expectedMaxUses);

  if (passed) {
    log(`   ✅ PASS - Race condition handled correctly!`, 'green');
    log(`   Expected: ≤${expectedMaxUses} success, ≥${concurrentRequests - expectedMaxUses} 'max uses' errors`, 'green');
  } else {
    log(`   ❌ FAIL - Race condition detected!`, 'red');
    log(`   Expected: ≤${expectedMaxUses} success, ≥${concurrentRequests - expectedMaxUses} 'max uses' errors`, 'red');
    log(`   Got: ${successCount} success, ${maxUsesErrors} 'max uses' errors`, 'red');
  }

  return { passed, successCount, failureCount, maxUsesErrors };
}

/**
 * Test 2: GatePass Scan Race Condition
 */
async function testGatePassRaceCondition() {
  log('\n📋 TEST 2: GatePass Scan Race Condition', 'cyan');
  log('   Objective: Only 1 scan should succeed, rest should fail\n');

  const { qrCode, guardId } = CONFIG.gatePass;
  const concurrentRequests = 10;

  log(`   Sending ${concurrentRequests} concurrent scan requests...`);

  const scanGatePass = async () => {
    try {
      const response = await axios.post(
        `${CONFIG.apiBase}/api/gatepasses/scan`,
        {
          qrCode,
          guardId,
        },
        {
          headers: {
            'Authorization': `Bearer ${CONFIG.guardToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
      };
    }
  };

  // Execute concurrent requests
  const requests = Array(concurrentRequests).fill(null).map(() => scanGatePass());
  const results = await Promise.all(requests);

  // Analyze results
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;
  const alreadyUsedErrors = results.filter(r =>
    r.message && r.message.toLowerCase().includes('already been used')
  ).length;

  log('   ✅ All requests completed\n');
  log('   📊 Results:');
  log(`      Successful scans: ${successCount}`);
  log(`      Failed scans: ${failureCount}`);
  log(`      'Already used' errors: ${alreadyUsedErrors}`);

  // Detailed breakdown
  console.log('\n   📝 Detailed breakdown:');
  results.forEach((result, index) => {
    if (result.success) {
      console.log(`      Request ${index + 1}: ✅ SUCCESS`);
    } else {
      console.log(`      Request ${index + 1}: ❌ FAILED - ${result.message}`);
    }
  });

  // Validate
  console.log('');
  const passed = successCount === 1 && alreadyUsedErrors >= 9;

  if (passed) {
    log(`   ✅ PASS - Race condition handled correctly!`, 'green');
    log(`   Expected: 1 success, ≥9 'already used' errors`, 'green');
  } else {
    log(`   ❌ FAIL - Race condition detected!`, 'red');
    log(`   Expected: 1 success, ≥9 'already used' errors`, 'red');
    log(`   Got: ${successCount} success, ${alreadyUsedErrors} 'already used' errors`, 'red');
  }

  return { passed, successCount, failureCount, alreadyUsedErrors };
}

/**
 * Main execution
 */
async function main() {
  log('\n🧪 Race Condition Testing', 'cyan');
  log('================================\n');

  log('⚙️  Configuration:', 'yellow');
  log(`   API: ${CONFIG.apiBase}`);
  log(`   Testing with concurrent requests\n`);

  // Check if config is set
  if (CONFIG.guardToken === 'YOUR_GUARD_TOKEN_HERE') {
    log('❌ ERROR: Please update the CONFIG object with your actual values!', 'red');
    log('   Edit tests/race-condition-test.js and set:', 'yellow');
    log('   - guardToken');
    log('   - preApproval.qrToken, flatId, societyId');
    log('   - gatePass.qrCode, guardId\n');
    process.exit(1);
  }

  try {
    // Run tests
    const test1 = await testPreApprovalRaceCondition();
    const test2 = await testGatePassRaceCondition();

    // Summary
    log('\n================================', 'cyan');
    log('🎉 Testing Complete!\n', 'cyan');

    log('📊 Summary:');
    log(`   Test 1 (PreApproval): ${test1.passed ? '✅ PASS' : '❌ FAIL'}`, test1.passed ? 'green' : 'red');
    log(`   Test 2 (GatePass): ${test2.passed ? '✅ PASS' : '❌ FAIL'}`, test2.passed ? 'green' : 'red');

    if (test1.passed && test2.passed) {
      log('\n✅ All race conditions handled correctly!', 'green');
      log('   Your backend is ready for concurrent QR scans.\n', 'green');
    } else {
      log('\n⚠️  Some tests failed!', 'yellow');
      log('   Please review the results and fix any issues.\n', 'yellow');
    }

    log('📝 Next Steps:');
    log('   1. Review detailed results above');
    log('   2. If any tests failed, check server logs');
    log('   3. Test society isolation: node tests/society-isolation-test.js');
    log('   4. Run full test suite: npm test\n');

  } catch (error) {
    log(`\n❌ Error running tests: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run tests
main();
