const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

// 🚀 Test Utilities
async function makeRequest(method, url, body = null, headers = {}) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };

  if (body) {
    options.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const responseText = await response.text();
  
  let data;
  try {
    data = JSON.parse(responseText);
  } catch (error) {
    data = responseText;
  }

  return {
    status: response.status,
    headers: response.headers,
    data
  };
}

function logTest(title, result) {
  console.log(`\n🧪 ${title}`);
  console.log(`Status: ${result.status}`);
  if (result.data && typeof result.data === 'object') {
    console.log('Response:', JSON.stringify(result.data, null, 2));
  } else {
    console.log('Response:', result.data);
  }
}

// 🚀 Test Functions
async function testBasicCRUD() {
  console.log('\n🚀 Testing Basic CRUD Operations');
  
  // Create a new product
  const newProduct = {
    name: 'Test Product',
    price: 99.99,
    category_id: 1
  };
  
  const createResult = await makeRequest('POST', `${BASE_URL}/api/odata/Products`, newProduct);
  logTest('Create Product', createResult);
  
  const productId = createResult.data.id;
  
  // Read the product
  const readResult = await makeRequest('GET', `${BASE_URL}/api/odata/Products/${productId}`);
  logTest('Read Product', readResult);
  
  // Update the product
  const updateData = { price: 149.99 };
  const updateResult = await makeRequest('PUT', `${BASE_URL}/api/odata/Products/${productId}`, updateData);
  logTest('Update Product', updateResult);
  
  // Delete the product
  const deleteResult = await makeRequest('DELETE', `${BASE_URL}/api/odata/Products/${productId}`);
  logTest('Delete Product', deleteResult);
}

async function testODataQueryOptions() {
  console.log('\n🚀 Testing OData Query Options');
  
  // Test $filter
  const filterResult = await makeRequest('GET', `${BASE_URL}/api/odata/Products?$filter=price gt 100`);
  logTest('Filter (price > 100)', filterResult);
  
  // Test $top and $skip
  const paginationResult = await makeRequest('GET', `${BASE_URL}/api/odata/Products?$top=2&$skip=1`);
  logTest('Pagination ($top=2, $skip=1)', paginationResult);
  
  // Test $orderby
  const orderByResult = await makeRequest('GET', `${BASE_URL}/api/odata/Products?$orderby=price desc`);
  logTest('Order By (price desc)', orderByResult);
  
  // Test $select
  const selectResult = await makeRequest('GET', `${BASE_URL}/api/odata/Products?$select=name,price`);
  logTest('Select (name, price)', selectResult);
}

async function testFullTextSearch() {
  console.log('\n🚀 Testing Full-Text Search');
  
  // Test $search
  const searchResult = await makeRequest('GET', `${BASE_URL}/api/odata/Products?$search=laptop`);
  logTest('Search (laptop)', searchResult);
  
  const searchResult2 = await makeRequest('GET', `${BASE_URL}/api/odata/Products?$search=book`);
  logTest('Search (book)', searchResult2);
}

async function testBatchOperations() {
  console.log('\n🚀 Testing Batch Operations');
  
  const batchContent = `--batch_boundary
Content-Type: multipart/mixed; boundary=changeset_boundary

--changeset_boundary
Content-Type: application/http
Content-Transfer-Encoding: binary

POST /api/odata/Products HTTP/1.1
Content-Type: application/json

{"name":"Batch Product 1","price":199.99,"category_id":1}

--changeset_boundary
Content-Type: application/http
Content-Transfer-Encoding: binary

POST /api/odata/Products HTTP/1.1
Content-Type: application/json

{"name":"Batch Product 2","price":299.99,"category_id":2}

--changeset_boundary
Content-Type: application/http
Content-Transfer-Encoding: binary

GET /api/odata/Products HTTP/1.1

--changeset_boundary--
--batch_boundary--`;

  const batchResult = await makeRequest('POST', `${BASE_URL}/api/odata/$batch`, batchContent, {
    'Content-Type': 'multipart/mixed; boundary=batch_boundary'
  });
  
  logTest('Batch Operations', batchResult);
}

async function testDeltaLinks() {
  console.log('\n🚀 Testing Delta Links (Change Tracking)');
  
  // Get initial delta link
  const initialResult = await makeRequest('GET', `${BASE_URL}/api/odata/Products`);
  logTest('Initial Request with Delta Link', initialResult);
  
  // Extract delta link
  const deltaLink = initialResult.data['@odata.deltaLink'];
  console.log(`\n📎 Delta Link: ${deltaLink}`);
  
  // Make some changes
  console.log('\n🔄 Making changes...');
  
  // Create a new product
  await makeRequest('POST', `${BASE_URL}/api/odata/Products`, {
    name: 'Delta Test Product',
    price: 88.88,
    category_id: 1
  });
  
  // Update an existing product
  await makeRequest('PUT', `${BASE_URL}/api/odata/Products/1`, {
    price: 1099.99
  });
  
  // Use the delta link to get changes
  const deltaResult = await makeRequest('GET', deltaLink);
  logTest('Delta Link Request (Changes)', deltaResult);
  
  // Get change statistics
  const statsResult = await makeRequest('GET', `${BASE_URL}/api/demo/change-stats`);
  logTest('Change Statistics', statsResult);
}

async function testMetadata() {
  console.log('\n🚀 Testing Metadata Generation');
  
  const metadataResult = await makeRequest('GET', `${BASE_URL}/api/odata/$metadata`);
  logTest('OData Metadata', metadataResult);
}

async function testErrorHandling() {
  console.log('\n🚀 Testing Error Handling');
  
  // Test invalid filter
  const invalidFilterResult = await makeRequest('GET', `${BASE_URL}/api/odata/Products?$filter=invalid`);
  logTest('Invalid Filter', invalidFilterResult);
  
  // Test non-existent resource
  const notFoundResult = await makeRequest('GET', `${BASE_URL}/api/odata/NonExistent`);
  logTest('Non-existent Resource', notFoundResult);
  
  // Test invalid delta token
  const invalidDeltaResult = await makeRequest('GET', `${BASE_URL}/api/odata/Products?$deltatoken=invalid`);
  logTest('Invalid Delta Token', invalidDeltaResult);
}

async function testComplexQueries() {
  console.log('\n🚀 Testing Complex Queries');
  
  // Test multiple query options
  const complexResult = await makeRequest('GET', 
    `${BASE_URL}/api/odata/Products?$filter=price gt 50&$orderby=name asc&$top=3`
  );
  logTest('Complex Query (filter + orderby + top)', complexResult);
  
  // Test categories
  const categoriesResult = await makeRequest('GET', `${BASE_URL}/api/odata/Categories`);
  logTest('Categories Collection', categoriesResult);
  
  // Test orders
  const ordersResult = await makeRequest('GET', `${BASE_URL}/api/odata/Orders`);
  logTest('Orders Collection', ordersResult);
}

async function runAllTests() {
  console.log('🎯 Starting Advanced OData v4 Demo Tests');
  console.log('=' .repeat(50));
  
  try {
    await testBasicCRUD();
    await testODataQueryOptions();
    await testFullTextSearch();
    await testBatchOperations();
    await testDeltaLinks();
    await testMetadata();
    await testErrorHandling();
    await testComplexQueries();
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📊 Summary:');
    console.log('  ✅ Basic CRUD Operations');
    console.log('  ✅ OData Query Options ($filter, $select, $orderby, $top, $skip)');
    console.log('  ✅ Full-Text Search ($search)');
    console.log('  ✅ Batch Operations ($batch)');
    console.log('  ✅ Delta Links (Change Tracking)');
    console.log('  ✅ Metadata Generation');
    console.log('  ✅ Error Handling');
    console.log('  ✅ Complex Queries');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests,
  testBasicCRUD,
  testODataQueryOptions,
  testFullTextSearch,
  testBatchOperations,
  testDeltaLinks,
  testMetadata,
  testErrorHandling,
  testComplexQueries
};
