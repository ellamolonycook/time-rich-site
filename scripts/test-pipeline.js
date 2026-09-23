const http = require('http');
const path = require('path');
const workerModule = require('../worker/src/index.js').default;

console.log('====================================================');
console.log('  STARTING TIME RICH FULL-PIPELINE INTEGRATION TEST ');
console.log('====================================================\n');

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log('  [PASS] ' + message);
      passed++;
    } else {
      console.error('  [FAIL] ' + message);
      failed++;
    }
  }

  // 1. Static Server Route Checks
  console.log('--- 1. Testing Local Static Web Pages ---');
  async function checkRoute(urlPath, label) {
    return new Promise((resolve) => {
      http.get('http://localhost:8000' + urlPath, (res) => {
        assert(res.statusCode === 200, label + ' returns HTTP 200 OK');
        resolve();
      }).on('error', (e) => {
        assert(false, label + ' failed to connect: ' + e.message);
        resolve();
      });
    });
  }

  await checkRoute('/accelerator/', 'Sales Page (/accelerator)');
  await checkRoute('/join/', 'Join Capture Page (/join)');
  await checkRoute('/onboard/', 'Onboarding Page (/onboard)');

  // 2. Cloudflare Worker Endpoint Unit Tests (Mock Environment)
  console.log('\n--- 2. Testing Worker Endpoints ---');
  const mockEnv = {
    ALLOWED_ORIGIN: '*',
    NOTION_TOKEN: 'mock_token',
    NOTION_SUPERHUMAN_COHORT1_DATABASE_ID: 'mock_db_id',
    THRIVECART_SECRET: 'test_secret',
    WHATSAPP_INVITE_URL: 'https://chat.whatsapp.com/test'
  };
  const background = [];
  const mockCtx = { waitUntil: (work) => background.push(work) };
  global.fetch = async (url) => {
    if (String(url).endsWith('/query')) {
      return new Response(JSON.stringify({ results: [{
        id: 'paid-order',
        properties: {
          Name: { type: 'title', title: [{ plain_text: 'TestUser' }] },
          'Payment Status': { type: 'select', select: { name: 'Paid' } },
          TrackingID: { type: 'rich_text', rich_text: [{ plain_text: 'test-uuid-9999' }] }
        }
      }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ id: 'page-1' }), { status: 200 });
  };

  // Test /join endpoint
  const joinReq = new Request('https://time-rich-forms.timerich.workers.dev/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: 'TestUser',
      email: 'testuser@example.com',
      superhumanAnswer: 'Building autonomous AI agents',
      trackingId: 'test-uuid-9999'
    })
  });

  const joinRes = await workerModule.fetch(joinReq, mockEnv, mockCtx);
  assert(joinRes.status === 200, 'POST /join returns HTTP 200');
  const joinData = await joinRes.json();
  assert(joinData.ok === true && joinData.trackingId === 'test-uuid-9999', 'POST /join returns tracking ID');

  // Test /thrivecart-webhook endpoint (Order Paid)
  const webhookReq = new Request('https://time-rich-forms.timerich.workers.dev/thrivecart-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'order.success',
      thrivecart_secret: 'test_secret',
      customer: { first_name: 'TestUser', email: 'testuser@example.com' },
      passthrough: { tracking_id: 'test-uuid-9999' },
      order_id: 'TC-12345',
      order_total: '997'
    })
  });

  const webhookRes = await workerModule.fetch(webhookReq, mockEnv, mockCtx);
  assert(webhookRes.status === 200, 'POST /thrivecart-webhook returns HTTP 200');
  const webhookData = await webhookRes.json();
  assert(webhookData.ok === true && webhookData.trackingId === 'test-uuid-9999', 'POST /thrivecart-webhook processes order');

  // Test /onboard verification endpoint (GET)
  const onboardGetReq = new Request('https://time-rich-forms.timerich.workers.dev/onboard?tracking_id=test-uuid-9999', {
    method: 'GET'
  });

  const onboardGetRes = await workerModule.fetch(onboardGetReq, mockEnv, mockCtx);
  assert(onboardGetRes.status === 200, 'GET /onboard returns HTTP 200');
  const onboardGetData = await onboardGetRes.json();
  assert(onboardGetData.ok === true && onboardGetData.verified === true, 'GET /onboard verifies order status');

  // Test /onboard seat selection endpoint (POST)
  const onboardPostReq = new Request('https://time-rich-forms.timerich.workers.dev/onboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trackingId: 'test-uuid-9999',
      email: 'testuser@example.com',
      choice: 'named',
      attendeeFirstName: 'Second',
      attendeeLastName: 'Attendee',
      attendeeEmail: 'second@example.com'
    })
  });

  const onboardPostRes = await workerModule.fetch(onboardPostReq, mockEnv, mockCtx);
  assert(onboardPostRes.status === 200, 'POST /onboard returns HTTP 200');
  const onboardPostData = await onboardPostRes.json();
  assert(onboardPostData.ok === true, 'POST /onboard saves second-seat attendee choices');

  // Test /thrivecart-webhook refund endpoint
  const refundReq = new Request('https://time-rich-forms.timerich.workers.dev/thrivecart-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'order.refund',
      thrivecart_secret: 'test_secret',
      customer: { email: 'testuser@example.com' },
      passthrough: { tracking_id: 'test-uuid-9999' }
    })
  });

  const refundRes = await workerModule.fetch(refundReq, mockEnv, mockCtx);
  assert(refundRes.status === 200, 'POST /thrivecart-webhook refund processes correctly');
  await Promise.all(background);

  const unsignedWebhook = new Request('https://time-rich-forms.timerich.workers.dev/thrivecart-webhook', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'order.success' })
  });
  const unsignedRes = await workerModule.fetch(unsignedWebhook, mockEnv, mockCtx);
  assert(unsignedRes.status === 401, 'POST /thrivecart-webhook rejects an invalid secret');

  console.log('\n====================================================');
  console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');
}

runTests();
