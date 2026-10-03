import { Linking, StyleSheet, View } from 'react-native';
import AppText from './ui/AppText';
import Card from './ui/Card';
import Logo from './ui/Logo';

const REPO_URL = 'https://github.com/kylestarrtech/billy-finance-manager';

export default function PrivacyScreen() {
    return (
        <Card style={styles.card}>
            <View style={styles.logo}>
                <Logo size={48} />
            </View>
            <AppText variant="h2" center style={styles.title}>A Statement on Privacy</AppText>

            <AppText muted center style={styles.paragraph}>
                Billy is designed with privacy specifically in mind. All data is stored and encrypted locally on your device and no data is sent to any servers. This is why you are required to set up a PIN to encrypt your data.
            </AppText>

            <AppText muted center style={styles.paragraph}>
                As proof of this promise, Billy is also entirely free and open-source. You can view the source code on{' '}
                <AppText
                    muted
                    style={styles.link}
                    onPress={() => Linking.openURL(REPO_URL)}
                    accessibilityRole="link"
                >
                    GitHub
                </AppText>.
            </AppText>

            <AppText muted center style={styles.paragraph}>
                There are no ads, no tracking, and no analytics. Your data is yours and yours alone. However, there are some areas where data is at risk such as exporting your data to a JSON format. If you choose to export your data, it will be stored in plaintext and is not encrypted. Please be careful with this data and do not share it with any party in which you do not wholly trust.
            </AppText>

            <AppText muted center>
                Contributions to the project are welcome! If you would like to contribute, please visit the GitHub repository and submit a pull request or open an issue.
            </AppText>
        </Card>
    );
}

const styles = StyleSheet.create({
    card: {
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: 24,
        backgroundColor: '#22222230',
    },
    logo: {
        marginBottom: 24,
    },
    title: {
        marginBottom: 16,
    },
    paragraph: {
        marginBottom: 18,
    },
    link: {
        textDecorationLine: 'underline',
    },
});
