import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface AssessmentTypeBadgeProps {
    type?: string | null;
    style?: ViewStyle;
    size?: 'small' | 'medium';
}

export const AssessmentTypeBadge: React.FC<AssessmentTypeBadgeProps> = ({ 
    type, 
    style,
    size = 'medium' 
}) => {
    const normType = String(type || '').trim().toLowerCase();
    
    let label = 'ASSIGNMENT';
    let iconName: keyof typeof Ionicons.glyphMap = 'document-text-outline';
    let bg = '#F0FDF4'; // Emerald 50
    let border = '#BBF7D0'; // Emerald 200
    let textColor = '#15803D'; // Emerald 700

    if (normType === 'quiz') {
        label = 'QUIZ';
        iconName = 'help-circle-outline';
        bg = '#EEF2FF'; // Indigo 50
        border = '#C7D2FE'; // Indigo 200
        textColor = '#4338CA'; // Indigo 700
    } else if (normType === 'activity') {
        label = 'ACTIVITY';
        iconName = 'bulb-outline';
        bg = '#FFFBEB'; // Amber 50
        border = '#FDE68A'; // Amber 200
        textColor = '#B45309'; // Amber 700
    } else if (normType === 'assignment' || normType === 'task') {
        label = 'ASSIGNMENT';
        iconName = 'document-text-outline';
        bg = '#F0FDF4';
        border = '#BBF7D0';
        textColor = '#15803D';
    } else if (normType) {
        label = normType.toUpperCase();
        iconName = 'clipboard-outline';
        bg = '#F8FAFC';
        border = '#E2E8F0';
        textColor = '#475569';
    }

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
