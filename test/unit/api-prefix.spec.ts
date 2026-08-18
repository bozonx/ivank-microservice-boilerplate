import { describe, it, expect } from '@jest/globals';
import {
  buildApiPrefix,
  buildPrefixedPath,
  normalizeBasePath,
} from '../../src/common/http/api-prefix.js';

describe('buildApiPrefix (unit)', () => {
  it('returns the bare api path when no base path is set', () => {
    expect(buildApiPrefix(undefined)).toBe('api/v1');
    expect(buildApiPrefix('')).toBe('api/v1');
    expect(buildApiPrefix('   ')).toBe('api/v1');
  });

  it('strips surrounding slashes from the base path', () => {
    expect(buildApiPrefix('/my-app/')).toBe('my-app/api/v1');
    expect(buildApiPrefix('my-app')).toBe('my-app/api/v1');
    expect(buildApiPrefix('///my-app///')).toBe('my-app/api/v1');
  });

  it('keeps inner slashes so nested prefixes work', () => {
    expect(buildApiPrefix('/team/my-app/')).toBe('team/my-app/api/v1');
  });

  it('accepts a custom api path', () => {
    expect(buildApiPrefix('app', 'api/v2')).toBe('app/api/v2');
  });

  it('normalizes a base path on its own', () => {
    expect(normalizeBasePath('/x/')).toBe('x');
    expect(normalizeBasePath(undefined)).toBe('');
  });

  it('builds prefixed paths with buildPrefixedPath', () => {
    expect(buildPrefixedPath(undefined, 'ui')).toBe('/ui');
    expect(buildPrefixedPath('', '/ui')).toBe('/ui');
    expect(buildPrefixedPath('app', 'ui')).toBe('/app/ui');
    expect(buildPrefixedPath('/app/', '/ui')).toBe('/app/ui');
  });
});
