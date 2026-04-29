import { createTheme } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'brand',
  primaryShade: 6,

  colors: {
    brand: [
      '#EEF4F8',
      '#DCE9F1',
      '#C7DCE8',
      '#B0CEDF',
      '#8FB8CE',
      '#6DA0BD',
      '#3F7CAC',
      '#356B96',
      '#2C5A7F',
      '#234969',
    ],

    sage: [
      '#F7F8F3',
      '#EEF0E6',
      '#E2E6D6',
      '#D4DABB',
      '#C7CFB0',
      '#BDC4A7',
      '#ADB595',
      '#98A07F',
      '#818A69',
      '#6B7455',
    ],

    lime: [
      '#FEFFF7',
      '#FAFDEB',
      '#F3FBD8',
      '#ECF9C0',
      '#E7F7AB',
      '#E2F89C',
      '#D0E57D',
      '#BBD05F',
      '#A4B947',
      '#8CA135',
    ],
  },

  defaultRadius: 'lg',

  components: {
    Card: {
      defaultProps: {
        radius: 'xl',
        shadow: 'sm',
        withBorder: true,
      },
    },

    Paper: {
      defaultProps: {
        radius: 'xl',
        shadow: 'sm',
        withBorder: true,
      },
    },

    Button: {
      defaultProps: {
        color: 'brand',
        radius: 'md',
      },
    },

    Badge: {
      defaultProps: {
        radius: 'md',
      },
    },

    Tabs: {
      defaultProps: {
        color: 'brand',
      },
    },

    TextInput: {
      defaultProps: {
        radius: 'md',
      },
    },

    Textarea: {
      defaultProps: {
        radius: 'md',
      },
    },

    Select: {
      defaultProps: {
        radius: 'md',
      },
    },
  },
});