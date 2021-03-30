import * as core from '@actions/core';
import { installAndroidSdk } from './sdk-installer';
import { checkApiLevel, checkTarget, checkArch, checkDisableAnimations, checkEmulatorBuild } from './input-validator';
import { launchEmulator, killEmulator } from './emulator-manager';
import * as exec from '@actions/exec';
import { parseScript } from './script-parser';

async function run() {
  try {
    // only support running on macOS or Linux
    if (process.platform !== 'darwin') {
      if (process.platform === 'linux') {
        console.warn(
          `You're running a Linux VM where hardware acceleration is not available. Please consider using a macOS VM instead to take advantage of native hardware acceleration support provided by HAXM.`
        );
      } else {
        throw new Error('Unsupported virtual machine: please use either macos or ubuntu VM.');
      }
    }

    // API level of the platform and system image
    const apiLevelInput = core.getInput('api-level', { required: true });
    checkApiLevel(apiLevelInput);
    const apiLevel = Number(apiLevelInput);
    console.log(`API level: ${apiLevel}`);

    // target of the system image
    const targetInput = core.getInput('target');
    const target = targetInput == 'playstore' ? 'google_apis_playstore' : targetInput;
    checkTarget(target);
    console.log(`target: ${target}`);

    // CPU architecture of the system image
    const arch = core.getInput('arch');
    checkArch(arch);
    console.log(`CPU architecture: ${arch}`);

    // Hardware profile used for creating the AVD
    const profile = core.getInput('profile');
    console.log(`Hardware profile: ${profile}`);

    // Number of cores to use for emulator
    const cores = core.getInput('cores');
    console.log(`Cores: ${cores}`);

    // SD card path or size used for creating the AVD
    const sdcardPathOrSize = core.getInput('sdcard-path-or-size');
    console.log(`SD card path or size: ${sdcardPathOrSize}`);

    // custom name used for creating the AVD
    const avdName = core.getInput('avd-name');
    console.log(`AVD name: ${avdName}`);

    // emulator options
    const emulatorOptions = core.getInput('emulator-options').trim();
    console.log(`emulator options: ${emulatorOptions}`);

    // disable animations
    const disableAnimationsInput = core.getInput('disable-animations');
    checkDisableAnimations(disableAnimationsInput);
    const disableAnimations = disableAnimationsInput === 'true';
    console.log(`disable animations: ${disableAnimations}`);

    // emulator build
    const emulatorBuildInput = core.getInput('emulator-build');
    if (emulatorBuildInput) {
      checkEmulatorBuild(emulatorBuildInput);
      console.log(`using emulator build: ${emulatorBuildInput}`);
    }
    const emulatorBuild = !emulatorBuildInput ? undefined : emulatorBuildInput;

    // custom working directory
    const workingDirectoryInput = core.getInput('working-directory');
    if (workingDirectoryInput) {
      console.log(`custom working directory: ${workingDirectoryInput}`);
    }
    const workingDirectory = !workingDirectoryInput ? undefined : workingDirectoryInput;

    // version of NDK to install
    const ndkInput = core.getInput('ndk');
    if (ndkInput) {
      console.log(`version of NDK to install: ${ndkInput}`);
    }
    const ndkVersion = !ndkInput ? undefined : ndkInput;

    // version of CMake to install
    const cmakeInput = core.getInput('cmake');
    if (cmakeInput) {
      console.log(`version of CMake to install: ${cmakeInput}`);
    }
    const cmakeVersion = !cmakeInput ? undefined : cmakeInput;

    const scriptInput = core.getInput('script', { required: true });
    const scripts = parseScript(scriptInput);
    console.log(`Script:`);
    scripts.forEach(async (script: string) => {
      console.log(`${script}`);
    });

    // install SDK
    await installAndroidSdk(apiLevel, target, arch, emulatorBuild, ndkVersion, cmakeVersion);

    // launch an emulator
    await launchEmulator(apiLevel, target, arch, profile, cores, sdcardPathOrSize, avdName, emulatorOptions, disableAnimations);

    /////// SHAKER

    // Adicionar adbRunTestsComand ao arquivo tests.sh
    const adbRunTestsComand = core.getInput('adb-run-tests', { required: true });
    console.log(`adb Run Tests Comand: ${adbRunTestsComand}`);

    //Rodar o comando para installar adbRunTestsComand
    const installComand = core.getInput('install-command', { required: true });
    console.log(`Installing App and tests\nInstall Command Comand: ${adbRunTestsComand}`);
    await exec.exec('sh', ['-c', installComand]);



    // 1. comando para instalar o aplicativo no emulador, ex.: ./gradlew assembleDebugAndroidTest (este é o default)
    // 2. comando para rodar os testes, por ex.: 
    // 2. adb shell am instrument -w -r    -e package org.isoron.uhabits -e debug false org.isoron.uhabits.test/androidx.test.runner.AndroidJUnitRunner

    // 3. chamar script sh ou zsh para rodar SHAKER:
    // https://github.com/AntennaPod/AntennaPod/tree/develop/.github/workflows




    // custom script to run
    // execute the custom script
    try {
      // move to custom working directory if set
      if (workingDirectory) {
        process.chdir(workingDirectory);
      }
      for (const script of scripts) {
        // use array form to avoid various quote escaping problems
        // caused by exec(`sh -c "${script}"`)
        await exec.exec('sh', ['-c', script]);
      }
    } catch (error) {
      core.setFailed(error.message);
    }

    // finally kill the emulator
    await killEmulator();
  } catch (error) {
    // kill the emulator so the action can exit
    await killEmulator();
    core.setFailed(error.message);
  }
}

run();
