import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface AssessmentTypeBadgeProps {
    type?: string | null;
    style?: ViewStyle;
    size?: 'small' | 'medium';
}

import { getAssessmentBadgeConfig, AssessmentBadgeConfig } from '../../utils/assessment-badge';

export { getAssessmentBadgeConfig, AssessmentBadgeConfig };

export const AssessmentTypeBadge: React.FC<AssessmentTypeBadgeProps> = ({ 
    type, 
    style,
    size = 'medium' 
}) => {
    const { label, iconName, bg, border, textColor } = getAssessmentBadgeConfig(type);

    const isSmall = size === 'small';

    return (
        <View style={[
            styles.badge, 
            { 
                backgroundColor: bg, 
                borderColor: border,
                paddingHorizontal: isSmall ? 6 : 8,
                paddingVertical: isSmall ? 2 : 3.5,
                borderRadius: isSmall ? 4 : 6,
            }, 
            style
        ]}>
            <Ionicons 
                name={iconName} 
                size={isSmall ? 11 : 13} 
                color={textColor} 
                style={{ marginRight: 4 }} 
            />
            <Text style={[
                styles.text, 
                { 
                    color: textColor,
                    fontSize: isSmall ? 10 : 11,
                }
            ]}>
                {label}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        alignSelf: 'flex-start',
    },
    text: {
        fontWeight: '700',
        letterSpacing: 0.5,
    },
});

export default AssessmentTypeBadge;
