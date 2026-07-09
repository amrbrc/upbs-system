// public/js/sms.js
// Handles clipboard copy and interactive animations for the SMS Reference Guide.

function copyToClipboard(text, element) {
    if (!navigator.clipboard) {
        // Fallback
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";  // Avoid scrolling to bottom
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            showFeedback(element);
        } catch (err) {
            console.error('Fallback: Oops, unable to copy', err);
        }
        document.body.removeChild(textArea);
        return;
    }
    
    navigator.clipboard.writeText(text).then(() => {
        showFeedback(element);
    }).catch(err => {
        console.error('Async: Could not copy text: ', err);
    });
}

function showFeedback(element) {
    const originalText = element.textContent;
    element.textContent = '✅ Copied!';
    element.style.color = 'var(--up-green)';
    element.style.fontWeight = 'bold';
    
    setTimeout(() => {
        element.textContent = originalText;
        element.style.color = '';
        element.style.fontWeight = '';
    }, 1500);
}
