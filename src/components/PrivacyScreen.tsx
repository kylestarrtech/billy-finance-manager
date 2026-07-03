export default function PrivacyScreen() {
    return (
        <div
            style={{
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                padding: '1rem',
                boxSizing: 'border-box',
                zIndex: 2000
            }}
        >
            <div
                className="card"
                style={{
                    width: 'min(680px, 100%)',
                    textAlign: 'center',
                    padding: '3rem 2rem',
                    backgroundColor: '#22222230',
                    maxHeight: '90vh',
                    overflowY: 'auto'
                }}
            >
                <img src="/logos/white-svg.svg" alt="Billy Logo" style={{ height: '48px', marginBottom: '1.5rem' }} />
                <h2 style={{ margin: '0 0 0.5rem 0' }}>A Statement on Privacy</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                    Billy is designed with privacy specifically in mind. All data is stored and encrypted locally on your device and no data is sent to any servers. This is why you are required to set up a PIN to encrypt your data.

                    <br /> <br />

                    As proof of this promise, Billy is also entirely free and open-source. You can view the source code on <a href="https://github.com/kylestarrtech/billy-finance-manager" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)' }}>GitHub</a>.

                    <br /> <br />

                    There are no ads, no tracking, and no analytics. Your data is yours and yours alone. However, there are some areas where data is at risk such as exporting your data to a JSON format. If you choose to export your data, it will be stored in plaintext and is not encrypted. Please be careful with this data and do not share it with any party in which you do not wholly trust.

                    <br /> <br />

                    Contributions to the project are welcome! If you would like to contribute, please visit the GitHub repository and submit a pull request or open an issue.
                </p>
            </div>
        </div>
    );
}