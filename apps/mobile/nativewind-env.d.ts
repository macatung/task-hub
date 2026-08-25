/// <reference types="nativewind/types" />

import 'react-native';

declare module 'react-native' {
  interface ViewProps {
    className?: string;
  }
  interface TextProps {
    className?: string;
  }
  interface TextInputProps {
    className?: string;
  }
  interface TouchableOpacityProps {
    className?: string;
  }
  interface TouchableWithoutFeedbackProps {
    className?: string;
  }
  interface ScrollViewProps {
    className?: string;
  }
  interface ImageProps {
    className?: string;
  }
  interface SwitchProps {
    className?: string;
  }
  interface FlatListProps<ItemT> {
    className?: string;
  }
  interface SectionListProps<ItemT> {
    className?: string;
  }
}

declare module 'react-native/Libraries/Text/Text' {
  interface TextProps {
    className?: string;
  }
}

declare module 'react-native/Libraries/Components/View/ViewPropTypes' {
  interface ViewProps {
    className?: string;
  }
}

declare module 'react-native/Libraries/Components/ScrollView/ScrollView' {
  interface ScrollViewProps {
    className?: string;
  }
}

declare module 'react-native/Libraries/Components/Touchable/TouchableOpacity' {
  interface TouchableOpacityProps {
    className?: string;
  }
}

declare module 'react-native/Libraries/Components/Touchable/TouchableWithoutFeedback' {
  interface TouchableWithoutFeedbackProps {
    className?: string;
  }
}

declare module 'react-native/Libraries/Components/TextInput/TextInput' {
  interface TextInputProps {
    className?: string;
  }
}

declare module 'react-native/Libraries/Components/Switch/Switch' {
  interface SwitchProps {
    className?: string;
  }
}

declare module 'react-native/Libraries/Lists/FlatList' {
  interface FlatListProps<ItemT> {
    className?: string;
  }
}

declare module 'react-native/Libraries/Lists/SectionList' {
  interface SectionListProps<ItemT> {
    className?: string;
  }
}

declare module 'react-native/Libraries/Image/Image' {
  interface ImageProps {
    className?: string;
  }
}
