# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Conexión con FashionStore Backend

La URL del API se configura mediante variables de Expo, no está fijada en el código.

1. Copia `.env.example` como `.env`.
2. Para producción, configura `EXPO_PUBLIC_API_URL` con la URL HTTPS de Render o Railway.
3. Para un teléfono físico en desarrollo, usa la IP Wi-Fi actual del computador, por ejemplo `http://192.168.100.11:3000`.
4. Reinicia Expo cuando cambies el archivo `.env`.

En Expo Web, si no se configura esa variable, la app usa automáticamente el mismo host de la página con el puerto `3000`. Android Emulator usa `http://10.0.2.2:3000`.

## APK y cambio de red

La APK permite cambiar la URL sin recompilar: abre **Iniciar sesión → Configurar servidor** o **Perfil → Configurar servidor**. Esa URL se guarda en el teléfono y se usa en cada petición.

- Para backend desplegado, usa una URL HTTPS estable, por ejemplo `https://fashionstore-api.onrender.com`.
- Para backend local, teléfono y computadora deben estar en la misma Wi-Fi. Usa `http://IP-DE-TU-PC:3000`, nunca `localhost`.
- Si cambia la IP de la red Wi-Fi, vuelve a Configurar servidor, actualiza la IP y guarda.

`eas.json` tiene los perfiles `preview` y `production-apk`, ambos generan un APK instalable. El perfil `production` genera el formato predeterminado AAB para Google Play.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
