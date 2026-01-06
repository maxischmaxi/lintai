/**
 * Intentionally bad code for testing code smell detection.
 */

// any abuse
export function processData(data: any) {
  const result: any = {};

  // Deep nesting
  if (data) {
    if (data.items) {
      if (data.items.length > 0) {
        for (let i = 0; i < data.items.length; i++) {
          if (data.items[i].active) {
            if (data.items[i].value > 0) {
              result[data.items[i].id] = data.items[i].value;
            }
          }
        }
      }
    }
  }

  return result;
}

// Bad naming
export const x = (a: any, b: any, c: any) => a + b + c;

export function fn(d: any) {
  let r = 0;
  for (let i = 0; i < d.length; i++) {
    r += d[i];
  }
  return r;
}

// God function - way too long
export function doEverything(input: any) {
  let result = 0;
  let temp = 0;
  let flag = false;
  let counter = 0;

  // Processing step 1
  if (input.type === "a") {
    result += 1;
    temp = result * 2;
    flag = true;
  }

  // Processing step 2
  if (input.type === "b") {
    result += 2;
    temp = result * 3;
    flag = false;
  }

  // Processing step 3
  for (let i = 0; i < 10; i++) {
    counter++;
    result += counter;
  }

  // Processing step 4
  if (flag) {
    result = result * temp;
  } else {
    result = result + temp;
  }

  // Processing step 5
  while (counter > 0) {
    result--;
    counter--;
  }

  // Processing step 6
  switch (input.mode) {
    case 1:
      result *= 2;
      break;
    case 2:
      result *= 3;
      break;
    case 3:
      result *= 4;
      break;
    default:
      result *= 1;
  }

  // Processing step 7
  if (result > 100) {
    result = 100;
  } else if (result < 0) {
    result = 0;
  }

  // More unnecessary processing
  temp = result;
  result = temp + 1;
  temp = result - 1;
  result = temp;

  return result;
}

// Missing error handling
export async function fetchData(url: string) {
  const response = await fetch(url);
  const data = await response.json();
  return data;
}

// Empty catch block
export function parseJSON(str: string) {
  try {
    return JSON.parse(str);
  } catch (e) {
    // Swallowed error - bad practice
  }
}

// Callback hell
export function callbackHell(callback: Function) {
  setTimeout(() => {
    fetch("/api/1").then((r) => {
      r.json().then((d) => {
        fetch("/api/2").then((r2) => {
          r2.json().then((d2) => {
            callback(d, d2);
          });
        });
      });
    });
  }, 1000);
}
