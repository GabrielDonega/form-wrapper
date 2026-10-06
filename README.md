# form-wrapper

Biblioteca **headless** de controle lógico de formulários: estado, valores, campos, validações, erros, dirty/touched, submissão e estruturas aninhadas — em TypeScript puro, sem dependência de Vue, React ou qualquer framework.

> Não é uma biblioteca de UI. Não conhece inputs, selects, mensagens visuais ou CSS. A camada de apresentação (ou um adapter de framework) decide como renderizar.

## Instalação

```bash
npm install form-wrapper
```

## Uso básico

```ts
import { createForm } from 'form-wrapper';

const form = createForm({
  initialValues: {
    user: {
      profile: { name: '', email: '' },
      address: { street: '', number: '', city: '' },
    },
  },
  validator: {
    validate: (values) => ({
      valid: values.user.profile.name !== '',
      errors: values.user.profile.name === ''
        ? { user: { profile: { name: 'Nome obrigatório' } } }
        : null,
    }),
  },
  onSubmit: async (values) => {
    await api.save(values); // recebe a estrutura aninhada completa
  },
});

form.setValue('user.profile.name', 'Gabriel'); // type-checked
form.getValue('user.address.city');
form.touch('user.profile.name');
await form.validateField('user.profile.name');
await form.submit(); // { status: 'submitted' | 'invalid' | 'error' | 'skipped', ... }
```

## API pública

### Estado (getters)

| Propriedade | Descrição |
|---|---|
| `values` | Objeto aninhado atual (mutar só via API) |
| `initialValues` | Clone defensivo dos valores iniciais (nunca mutado) |
| `errors` | Erros aninhados espelhando a estrutura de `values` |
| `touched` | Estrutura aninhada de touched |
| `isDirty` | Algum valor difere de `initialValues` (comparação profunda) |
| `isValid` | Sem erros (validação e externos) |
| `isSubmitting` | `onSubmit` em execução |
| `isValidating` | Alguma validação em andamento |
| `isSubmitted` | Último submit completou com sucesso |
| `submitCount` | Total de tentativas de submit |
| `state` | Snapshot consistente de tudo acima |

### Métodos

- **Valores**: `getValue(path)`, `setValue(path, value)`
- **Erros**: `getError(path)`, `setError(path, msg)` (canal externo/servidor), `clearError(path)`, `clearErrors(path?)`, `setErrors(nested)` (aplica erros de API, substituindo os externos anteriores)
- **Touched**: `touch(path)`
- **Validação**: `validate()`, `validateField(path)`
- **Submit**: `submit()` — valida antes de executar `onSubmit`; retorna resultado discriminado tipado; proteção contra submits concorrentes; `isSubmitting` sempre restaurado
- **Reset**: `reset()`, `resetField(path)` (funciona para leaf, objeto ou array)
- **Controllers**: `field(path)` (value, error, touched, dirty, valid, validating + métodos), `array(path)` (append, prepend, insert, remove, replace, move, clear — remapeando errors/touched automaticamente)
- **Adapters**: `subscribe(listener)` — notificação de mudanças para integração com frameworks

## Type safety de paths

A partir de `initialValues`, os tipos `Path<T>`, `PathValue<T, P>` e `ArrayPath<T>` inferem os paths válidos e o tipo do valor em cada um:

```ts
form.setValue('user.profile.name', 'Gabriel'); // ok — string
form.setValue('age', 30);                      // ok — number
form.setValue('age', '30');                    // ✗ erro de tipo
form.setValue('user.nope', 1);                 // ✗ path inexistente
form.array('users.0.tags');                    // ok — array
form.array('user.profile');                    // ✗ não é array
```

## Validadores

O core é agnóstico. Qualquer adapter implementa a interface:

```ts
interface FormValidator<TValues> {
  validate(values: TValues): ValidationResult<TValues> | Promise<ValidationResult<TValues>>;
}

interface ValidationResult<TValues = unknown> {
  valid: boolean;
  errors: FormErrors<TValues> | null; // estrutura aninhada espelhando values
}
```

Adapters planejados: `validator-zod`, `validator-valibot`, etc. Um validator customizado (como acima) também funciona.

## Arquitetura

```
core (TypeScript puro, sem reatividade)
  └── framework adapters (futuro: useForm do Vue/React via subscribe())
        └── UI da aplicação
```

```
src/
  types.ts            tipos públicos (FormApi, FormValidator, SubmitOutcome…)
  form.ts             createForm — orquestração
  field.ts            FieldApi por path
  array.ts            ArrayApi com remapeamento de índices
  validation.ts       aplicação de resultados de validação
  paths/types.ts      Path<T>, PathValue<T, P>, ArrayPath<T>
  paths/operations.ts getByPath, setByPath, deleteByPath, hasPath
  pathMap.ts          store path-keyed (errors/touched) + remapIndices
  equality.ts         deepEqual, deepClone
```

## Decisões de design

- **Imutabilidade seletiva**: mutações criam novas raízes com compartilhamento estrutural; `initialValues` e itens de array são deep-clonados. A API é à prova de mutação externa.
- **Dois canais de erro**: erros de validação (escritos apenas por `validate()`) e erros externos/servidor (`setError`/`setErrors`). `getError` mescla os dois (servidor tem precedência); `isValid` considera ambos.
- **Versionamento de validação**: toda mutação de valores invalida validações em voo; resultados antigos nunca sobrescrevem os novos.
- **`submit()` retornа, não lança**: `{ status: 'submitted' | 'invalid' | 'error' | 'skipped' }` — nenhum erro engolido silenciosamente.

## Limitações conhecidas

- Índices de array são tipados como `${number}`; por isso, strings numéricas como `'0.1'` também satisfazem o padrão (ex.: `'matrix.0.1'` é aceito mesmo sem que `0.1` seja um índice válido). Trade-off deliberado por simplicidade de tipos e autocomplete.
- Índices de array em erros/touched geram arrays possivelmente esparsos na estrutura aninhada exposta (`users.0` e `users.2` com erro → buraco em `1`).
- Não há validação automática em `setValue` (validateOnChange/Blur) — fica para o adapter de framework, que tem o contexto de UI.

## Desenvolvimento

```bash
npm install
npm test          # vitest run (inclui typecheck dos testes de tipos)
npm run typecheck
npm run build
```

## Próximos passos sugeridos

1. `@form-wrapper/validator-zod` (e demais adapters de validação)
2. `@form-wrapper/vue` com `useForm()` reativo via `subscribe()`
3. Opções de validação reativa (`validateOnBlur`, `validateOnChange`) no adapter
4. Suporte a `Set`/`Map` e objetos de classe como valores
