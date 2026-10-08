import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
  popupGlassMenu,
  registerGlassMenuIPC,
} from '../../../electron/main/services/glass-menu.mjs';

function fixture() {
  const wc = new EventEmitter();
  wc.id = Math.random();
  wc.mainFrame = {};
  wc.isDestroyed = () => false;
  const messages = [];
  wc.send = (name, value) => messages.push({ name, value });
  const Menu = { buildFromTemplate: (items) => ({ items }) };
  let choose;
  registerGlassMenuIPC({
    handle: (_name, handler) => {
      choose = handler;
    },
  });
  return { target: { webContents: wc }, wc, messages, Menu, choose };
}

test('glass menus preserve native default and constrain choices to the owning frame', () => {
  const f = fixture();
  let calls = 0,
    closed = 0;
  const args = {
    target: f.target,
    Menu: f.Menu,
    template: [
      { label: 'Retry', click: () => calls++ },
      { type: 'separator' },
      { label: 'Disabled', enabled: false, click: () => calls++ },
    ],
    callback: () => closed++,
  };
  assert.equal(popupGlassMenu({ ...args, enabled: false }), false);
  assert.equal(f.messages.length, 0);
  if (process.platform !== 'darwin') return;
  assert.equal(popupGlassMenu({ ...args, enabled: true }), true);
  const menu = f.messages[0].value;
  assert.equal('click' in menu.items[0], false);
  const event = { sender: f.wc, senderFrame: f.wc.mainFrame };
  assert.equal(f.choose({ ...event, senderFrame: {} }, { id: menu.id, item: '0' }), false);
  assert.equal(f.choose(event, { id: 'stale', item: '0' }), false);
  assert.equal(f.choose(event, { id: menu.id, item: '1' }), false);
  assert.equal(f.choose(event, { id: menu.id, item: '2' }), false);
  assert.equal(calls, 0);
  assert.equal(f.choose(event, { id: menu.id, item: '0' }), true);
  assert.equal(calls, 1);
  assert.equal(closed, 1);
  assert.equal(f.choose(event, { id: menu.id, item: '0' }), false);
});

test('replacing, dismissing and navigating away close menus without running commands', () => {
  if (process.platform !== 'darwin') return;
  const f = fixture();
  let calls = 0,
    closed = 0;
  const show = () =>
    popupGlassMenu({
      target: f.target,
      Menu: f.Menu,
      enabled: true,
      template: [{ label: 'Copy', click: () => calls++ }],
      callback: () => closed++,
    });
  show();
  show();
  assert.equal(closed, 1);
  let id = f.messages.findLast((m) => m.name === 'glass-menu:open').value.id;
  assert.equal(f.choose({ sender: f.wc, senderFrame: f.wc.mainFrame }, { id, item: null }), true);
  assert.equal(closed, 2);
  assert.equal(calls, 0);
  show();
  f.wc.emit('did-start-navigation');
  assert.equal(closed, 3);
  assert.equal(f.wc.listenerCount('destroyed'), 0);
});
