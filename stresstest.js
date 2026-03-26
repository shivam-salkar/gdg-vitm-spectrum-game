import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.VITE_GAME_SERVER_URL || 'https://socket.graphex.me';

export const options = {
  scenarios: {
    surge_to_200: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 30 },   // 0 -> 30
        { duration: '1m', target: 300 },  // 100 -> 150
        { duration: '2m', target: 500 },   // hold 200 users
        { duration: '30s', target: 0 },    // ramp down
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],   // <1% failures
    http_req_duration: ['p(95)<300'], // 95% < 300ms
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/`); // change path if needed

  check(res, {
    'status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400,
  });

  // simulate user think time between actions
  sleep(1 + Math.random() * 2);
}

// sudo apt-get update && sudo apt-get install -y k6
// VITE_GAME_SERVER_URL=https://socket.graphex.me k6 run stresstest.js
// k6 run stresstest.js
