'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
let intersect, visibility, state;
const document = {
  hidden: false,
  querySelector: () => ({style: {setProperty: (_, value) => {state = value;}}}),
  addEventListener: (_, callback) => {visibility = callback;}
};
vm.runInNewContext(fs.readFileSync('assets/js/auth-art-v1.js', 'utf8'), {
  document,
  IntersectionObserver: class { constructor(callback) {intersect = callback;} observe() {} }
});
intersect([{isIntersecting: true}]);
assert.equal(state, 'running');
document.hidden = true;
visibility();
assert.equal(state, 'paused');
document.hidden = false;
intersect([{isIntersecting: false}]);
assert.equal(state, 'paused');
intersect([{isIntersecting: true}]);
assert.equal(state, 'running');
console.log('Auth art pauses off-screen and while hidden.');
