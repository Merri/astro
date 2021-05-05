import { suite } from 'uvu';
import * as assert from 'uvu/assert';
import { doc } from './test-utils.js';
import { setup } from './helpers.js';

const StylesSSR = suite('Styles SSR');

/** Basic CSS minification; removes some flakiness in testing CSS */
function cssMinify(css) {
  return css
    .trim() // remove whitespace
    .replace(/\n\s*/g, '') // collapse lines
    .replace(/\s*\{/g, '{') // collapse selectors
    .replace(/:\s*/g, ':') // collapse attributes
    .replace(/;}/g, '}'); // collapse block
}

setup(StylesSSR, './fixtures/astro-styles-ssr');

StylesSSR('Has <link> tags', async ({ runtime }) => {
  const MUST_HAVE_LINK_TAGS = [
    '/_astro/components/ReactCSS.css',
    '/_astro/components/ReactModules.module.css',
    '/_astro/components/SvelteScoped.svelte.css',
    '/_astro/components/VueCSS.vue.css',
    '/_astro/components/VueModules.vue.css',
    '/_astro/components/VueScoped.vue.css',
  ];

  const result = await runtime.load('/');
  const $ = doc(result.contents);

  for (const href of MUST_HAVE_LINK_TAGS) {
    const el = $(`link[href="${href}"]`);
    assert.equal(el.length, 1);
  }
});

StylesSSR('Has correct CSS classes', async ({ runtime }) => {
  // TODO: remove this (temporary CI patch)
  if (process.version.startsWith('v14.')) {
    return;
  }

  const result = await runtime.load('/');
  const $ = doc(result.contents);

  const MUST_HAVE_CLASSES = {
    '#react-css': 'react-title',
    '#react-modules': 'title', // ⚠️  this should be transformed
    '#vue-css': 'vue-title',
    '#vue-modules': 'title', // ⚠️  this should also be transformed
    '#vue-scoped': 'vue-title', // also has data-v-* property
    '#svelte-scoped': 'svelte-title', // also has additional class
  };

  for (const [selector, className] of Object.entries(MUST_HAVE_CLASSES)) {
    const el = $(selector);
    if (selector === '#react-modules' || selector === '#vue-modules') {
      // this will generate differently on Unix vs Windows. Here we simply test that it has transformed
      assert.match(el.attr('class'), new RegExp(`^_${className}_[A-Za-z0-9-_]+`)); // className should be transformed, surrounded by underscores and other stuff
    } else {
      // if this is not a CSS module, it should remain as expected
      assert.ok(el.attr('class').includes(className));
    }

    // add’l test: Vue Scoped styles should have data-v-* attribute
    if (selector === '#vue-scoped') {
      const { attribs } = el.get(0);
      const scopeId = Object.keys(attribs).find((k) => k.startsWith('data-v-'));
      assert.ok(scopeId);
    }

    // add’l test: Svelte should have another class
    if (selector === '#svelte-title') {
      assert.not.equal(el.attr('class'), className);
    }
  }
});

StylesSSR('CSS Module support in .astro', async ({ runtime }) => {
  const result = await runtime.load('/');
  const $ = doc(result.contents);

  let scopedClass;

  // test 1: <style> tag in <head> is transformed
  const css = cssMinify(
    $('style')
      .html()
      .replace(/\.astro-[A-Za-z0-9-]+/, (match) => {
        scopedClass = match; // get class hash from result
        return match;
      })
  );

  assert.match(css, `.wrapper${scopedClass}{margin-left:auto;margin-right:auto;max-width:1200px}`);

  // test 2: element received .astro-XXXXXX class (this selector will succeed if transformed correctly)
  const wrapper = $(`.wrapper${scopedClass}`);
  assert.equal(wrapper.length, 1);
});

StylesSSR.run();