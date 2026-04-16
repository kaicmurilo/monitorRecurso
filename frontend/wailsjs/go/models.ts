export namespace collector {
	
	export class Metrics {
	    CPUPercent: number;
	    RAMPercent: number;
	    DiskPercent: number;
	    CPUTempCelsius: number;
	    NetUpBytesPerSec: number;
	    NetDownBytesPerSec: number;
	    GPUPercent: number;
	    BatteryPercent: number;
	    HasGPU: boolean;
	    HasBattery: boolean;
	    RawSent: number;
	    RawRecv: number;
	    RawTime: number;
	
	    static createFrom(source: any = {}) {
	        return new Metrics(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.CPUPercent = source["CPUPercent"];
	        this.RAMPercent = source["RAMPercent"];
	        this.DiskPercent = source["DiskPercent"];
	        this.CPUTempCelsius = source["CPUTempCelsius"];
	        this.NetUpBytesPerSec = source["NetUpBytesPerSec"];
	        this.NetDownBytesPerSec = source["NetDownBytesPerSec"];
	        this.GPUPercent = source["GPUPercent"];
	        this.BatteryPercent = source["BatteryPercent"];
	        this.HasGPU = source["HasGPU"];
	        this.HasBattery = source["HasBattery"];
	        this.RawSent = source["RawSent"];
	        this.RawRecv = source["RawRecv"];
	        this.RawTime = source["RawTime"];
	    }
	}

}

export namespace config {
	
	export class Alerts {
	    CooldownSeconds: number;
	    CPUPercent: number;
	    RAMPercent: number;
	    DiskPercent: number;
	    CPUTempCelsius: number;
	    GPUPercent: number;
	    BatteryLow: number;
	
	    static createFrom(source: any = {}) {
	        return new Alerts(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.CooldownSeconds = source["CooldownSeconds"];
	        this.CPUPercent = source["CPUPercent"];
	        this.RAMPercent = source["RAMPercent"];
	        this.DiskPercent = source["DiskPercent"];
	        this.CPUTempCelsius = source["CPUTempCelsius"];
	        this.GPUPercent = source["GPUPercent"];
	        this.BatteryLow = source["BatteryLow"];
	    }
	}
	export class Position {
	    X: number;
	    Y: number;
	
	    static createFrom(source: any = {}) {
	        return new Position(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.X = source["X"];
	        this.Y = source["Y"];
	    }
	}
	export class General {
	    IntervalSeconds: number;
	    Opacity: number;
	    AlwaysOnTop: boolean;
	    Position: Position;
	
	    static createFrom(source: any = {}) {
	        return new General(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.IntervalSeconds = source["IntervalSeconds"];
	        this.Opacity = source["Opacity"];
	        this.AlwaysOnTop = source["AlwaysOnTop"];
	        this.Position = this.convertValues(source["Position"], Position);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Config {
	    General: General;
	    Alerts: Alerts;
	
	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.General = this.convertValues(source["General"], General);
	        this.Alerts = this.convertValues(source["Alerts"], Alerts);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	

}

