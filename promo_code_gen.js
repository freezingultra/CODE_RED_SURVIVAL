const promoCodeElement = document.getElementById("promo-code");
const generateBtn = document.getElementById("generate-btn");

function generatePromoCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

generateBtn.addEventListener("click", () => {
    const newPromoCode = generatePromoCode();
    promoCodeElement.textContent = newPromoCode;

    // This part is tricky because we can't directly write to the filesystem from browser JS.
    // We will log it to the console, and the user can copy it.
    // A more robust solution would involve a server-side component.
    console.log("Generated Promo Code:", newPromoCode);

    // To simulate saving, we can use localStorage
    let promoCodes = JSON.parse(localStorage.getItem("promoCodes") || "[]");
    promoCodes.push({ code: newPromoCode, used: false });
    localStorage.setItem("promoCodes", JSON.stringify(promoCodes));
    alert("Promo code generated and saved to localStorage!");
});