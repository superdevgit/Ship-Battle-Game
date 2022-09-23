////////////////////////////////////////////////////////////////////////////////
//                            Pirate Ship Battles                             //
//                                                                            //
//                            Tests - Server - Box                            //
////////////////////////////////////////////////////////////////////////////////

const Box = require('../../server/box.js'); // todo : Improve this finding the absolute root

////////////////////////////////////////////////////////////////////////////////
test('server/box: class Box - constructor', () => {
  let box = new Box(800, 600, 'box');
  expect(box.x).toBeGreaterThanOrEqual(100);
  expect(box.x).toBeLessThanOrEqual(700);
  expect(box.y).toBeGreaterThanOrEqual(100);
  expect(box.y).toBeLessThanOrEqual(500);
  expect(box.bullets).toBeGreaterThanOrEqual(1);
  expect(box.bullets).toBeLessThanOrEqual(10);
  expect(box.type).toBe('box');
});

////////////////////////////////////////////////////////////////////////////////
