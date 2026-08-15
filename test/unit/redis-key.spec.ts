import { createKeyBuilder, keyPattern } from '../../src/common/redis/redis-key.js';

describe('redis key helper (unit)', () => {
  it('prefixes every key', () => {
    const key = createKeyBuilder('my-service:');
    expect(key('session', 42)).toBe('my-service:session:42');
  });

  it('adds the separator when the prefix lacks one', () => {
    const key = createKeyBuilder('my-service');
    expect(key('a')).toBe('my-service:a');
  });

  it('refuses an empty prefix, since an unprefixed key is never acceptable', () => {
    expect(() => createKeyBuilder('')).toThrow('prefix must not be empty');
    expect(() => createKeyBuilder('   ')).toThrow('prefix must not be empty');
  });

  it('refuses a key with no parts', () => {
    const key = createKeyBuilder('svc:');
    expect(() => key()).toThrow('at least one part');
  });

  it('refuses keys containing spaces', () => {
    const key = createKeyBuilder('svc:');
    expect(() => key('two words')).toThrow('must not contain spaces');
  });

  it('builds a scan pattern covering the prefix', () => {
    expect(keyPattern('svc')).toBe('svc:*');
    expect(keyPattern('svc:')).toBe('svc:*');
  });
});
