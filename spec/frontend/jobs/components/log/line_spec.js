import { shallowMount } from '@vue/test-utils';
import Line from '~/jobs/components/log/line.vue';
import LineNumber from '~/jobs/components/log/line_number.vue';

const httpUrl = 'http://example.com';
const httpsUrl = 'https://example.com';
const queryUrl = 'https://example.com?param=val';

const mockProps = ({ text = 'Running with gitlab-runner 12.1.0 (de7731dd)' } = {}) => ({
  line: {
    content: [
      {
        text,
        style: 'term-fg-l-green',
      },
    ],
    lineNumber: 0,
  },
  path: '/jashkenas/underscore/-/jobs/335',
});

describe('Job Log Line', () => {
  let wrapper;
  let data;
  let originalGon;

  const createComponent = (props = {}) => {
    wrapper = shallowMount(Line, {
      propsData: {
        ...props,
      },
    });
  };

  const findLine = () => wrapper.find('span');
  const findLink = () => findLine().find('a');
  const findLinks = () => findLine().findAll('a');
  const findLinkAttributeByIndex = i =>
    findLinks()
      .at(i)
      .attributes();

  beforeEach(() => {
    originalGon = window.gon;
    window.gon.features = {
      ciJobLineLinks: false,
    };

    data = mockProps();
    createComponent(data);
  });

  afterEach(() => {
    window.gon = originalGon;
  });

  it('renders the line number component', () => {
    expect(wrapper.find(LineNumber).exists()).toBe(true);
  });

  it('renders a span the provided text', () => {
    expect(findLine().text()).toBe(data.line.content[0].text);
  });

  it('renders the provided style as a class attribute', () => {
    expect(findLine().classes()).toContain(data.line.content[0].style);
  });

  describe.each([true, false])('when feature ci_job_line_links enabled = %p', ciJobLineLinks => {
    beforeEach(() => {
      window.gon.features = {
        ciJobLineLinks,
      };
    });

    it('renders text with symbols', () => {
      const text = 'apt-get update < /dev/null > /dev/null';
      createComponent(mockProps({ text }));

      expect(findLine().text()).toBe(text);
    });

    it.each`
      tag         | text
      ${'a'}      | ${'<a href="#">linked</a>'}
      ${'script'} | ${'<script>doEvil();</script>'}
      ${'strong'} | ${'<strong>highlighted</strong>'}
    `('escapes `<$tag>` tags in text', ({ tag, text }) => {
      createComponent(mockProps({ text }));

      expect(
        findLine()
          .find(tag)
          .exists(),
      ).toBe(false);
      expect(findLine().text()).toBe(text);
    });
  });

  describe('when ci_job_line_links is enabled', () => {
    beforeEach(() => {
      window.gon.features = {
        ciJobLineLinks: true,
      };
    });

    it('renders an http link', () => {
      createComponent(mockProps({ text: httpUrl }));

      expect(findLink().text()).toBe(httpUrl);
      expect(findLink().attributes().href).toBe(httpUrl);
    });

    it('renders an https link', () => {
      createComponent(mockProps({ text: httpsUrl }));

      expect(findLink().text()).toBe(httpsUrl);
      expect(findLink().attributes().href).toBe(httpsUrl);
    });

    it('renders a link with rel nofollow and noopener', () => {
      createComponent(mockProps({ text: httpsUrl }));

      expect(findLink().attributes().rel).toBe('nofollow noopener noreferrer');
    });

    it('renders a link with corresponding styles', () => {
      createComponent(mockProps({ text: httpsUrl }));

      expect(findLink().classes()).toEqual(['gl-reset-color!', 'gl-text-decoration-underline']);
    });

    it('renders a links with queries, surrounded by questions marks', () => {
      createComponent(mockProps({ text: `Did you see my url ${queryUrl}??` }));

      expect(findLine().text()).toBe('Did you see my url https://example.com?param=val??');
      expect(findLinkAttributeByIndex(0).href).toBe(queryUrl);
    });

    it('renders a links with queries, surrounded by exclamation marks', () => {
      createComponent(mockProps({ text: `No! The ${queryUrl}!?` }));

      expect(findLine().text()).toBe('No! The https://example.com?param=val!?');
      expect(findLinkAttributeByIndex(0).href).toBe(queryUrl);
    });

    it('renders a multiple links surrounded by text', () => {
      createComponent(
        mockProps({ text: `Well, my HTTP url: ${httpUrl} and my HTTPS url: ${httpsUrl}` }),
      );
      expect(findLine().text()).toBe(
        'Well, my HTTP url: http://example.com and my HTTPS url: https://example.com',
      );

      expect(findLinks()).toHaveLength(2);

      expect(findLinkAttributeByIndex(0).href).toBe(httpUrl);
      expect(findLinkAttributeByIndex(1).href).toBe(httpsUrl);
    });

    it('renders a multiple links surrounded by text, with other symbols', () => {
      createComponent(
        mockProps({ text: `${httpUrl}, ${httpUrl}: ${httpsUrl}; ${httpsUrl}. ${httpsUrl}...` }),
      );
      expect(findLine().text()).toBe(
        'http://example.com, http://example.com: https://example.com; https://example.com. https://example.com...',
      );

      expect(findLinks()).toHaveLength(5);

      expect(findLinkAttributeByIndex(0).href).toBe(httpUrl);
      expect(findLinkAttributeByIndex(1).href).toBe(httpUrl);
      expect(findLinkAttributeByIndex(2).href).toBe(httpsUrl);
      expect(findLinkAttributeByIndex(3).href).toBe(httpsUrl);
      expect(findLinkAttributeByIndex(4).href).toBe(httpsUrl);
    });

    const jshref = 'javascript:doEvil();'; // eslint-disable-line no-script-url

    test.each`
      type           | text
      ${'js'}        | ${jshref}
      ${'file'}      | ${'file:///a-file'}
      ${'ftp'}       | ${'ftp://example.com/file'}
      ${'email'}     | ${'email@example.com'}
      ${'no scheme'} | ${'example.com/page'}
    `('does not render a $type link', ({ text }) => {
      createComponent(mockProps({ text }));
      expect(findLink().exists()).toBe(false);
    });
  });
});
