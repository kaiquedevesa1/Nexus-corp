const EMAIL_ENDPOINT = "https://formsubmit.co/ajax/nexus.corp5643@gmail.com";

const normalize = (value) => String(value ?? "").trim();

/**
 * Envia os dados preenchidos por e-mail via FormSubmit. O acesso ao WhatsApp
 * e um link independente no HTML e nao depende da validacao do formulario.
 */
export function createContactForm(form) {
  if (!form) return { dispose() {} };

  const status = form.querySelector(".contact-form__status");
  const emailButton = form.querySelector("[data-contact-email]");

  const setStatus = (message, state = "") => {
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-success", state === "success");
    status.classList.toggle("is-error", state === "error");
  };

  const validate = () => {
    form.classList.add("was-validated");
    const invalid = form.querySelector(":invalid");
    if (!invalid) return true;

    invalid.closest(".contact-field")?.classList.add("is-invalid");
    invalid.focus({ preventScroll: true });
    invalid.scrollIntoView({ behavior: "smooth", block: "center" });
    setStatus("Revise os campos destacados antes de continuar.", "error");
    return false;
  };

  const getValues = () => {
    const data = new FormData(form);
    return {
      name: normalize(data.get("name")),
      email: normalize(data.get("email")),
      message: normalize(data.get("message")),
      honey: normalize(data.get("_honey")),
    };
  };

  const setBusy = (busy) => {
    form.setAttribute("aria-busy", String(busy));
    if (emailButton) emailButton.disabled = busy;
  };

  const onInput = (event) => {
    const field = event.target.closest(".contact-field");
    if (field && event.target.checkValidity()) field.classList.remove("is-invalid");
    setStatus("");
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    const { name, email, message, honey } = getValues();
    if (honey) return;

    setBusy(true);
    setStatus("Enviando sua mensagem por e-mail…");

    try {
      const response = await fetch(EMAIL_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          message,
          _subject: `Nova mensagem pelo site — ${name}`,
          _template: "table",
          _honey: honey,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success === false || result.success === "false") {
        throw new Error(result.message || "Falha no envio do formulario");
      }

      form.reset();
      form.classList.remove("was-validated");
      setStatus("Mensagem enviada! Responderemos pelo e-mail informado.", "success");
    } catch (error) {
      console.warn("Envio do formulario:", error);
      setStatus(
        "Não foi possível enviar por e-mail agora. Tente novamente ou use o WhatsApp.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  form.addEventListener("input", onInput);
  form.addEventListener("change", onInput);
  form.addEventListener("submit", onSubmit);

  return {
    dispose() {
      form.removeEventListener("input", onInput);
      form.removeEventListener("change", onInput);
      form.removeEventListener("submit", onSubmit);
    },
  };
}
