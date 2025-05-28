import axios from 'axios';

async function testPriceApi() {
  try {
    const response = await axios.get('https://api.pumpfunapi.org/price/Yngq1h5T6frA435CcP46a6emZuaqfs9bjPiPxAKpump');
    
    // Log the response data
    console.log('Price Data:', response.data);
  } catch (error) {
    // If there was an error, log it
    console.error('Error fetching price:', error.message);
  }
}

// Call the test function
testPriceApi();